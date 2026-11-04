/**
 * Import parser tests. Run with:
 *
 *   npm run test:import
 *
 * Covers the parts of a real export that break naive parsers: quoted commas,
 * embedded newlines in notes, escaped quotes, a UTF-8 BOM, otpauth:// TOTP
 * URIs, Proton's split email/username fields, multi-URL login items, trash,
 * the Proton `.zip` archive path, Proton passkey recovery (MessagePack COSE
 * key -> WebCrypto sign/verify), and the CSV export round-trip.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = mkdtempSync(join(tmpdir(), 'vw-import-'));

function build() {
    const tsc = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
    execFileSync(process.execPath, [
        tsc,
        join(ROOT, 'src/utils/import.ts'),
        join(ROOT, 'src/utils/export.ts'),
        join(ROOT, 'src/utils/domain.ts'),
        '--outDir', outDir,
        '--module', 'ES2020', '--target', 'ES2020',
        '--moduleResolution', 'bundler', '--lib', 'ES2020,DOM',
        '--strict', '--skipLibCheck',
    ], { stdio: 'inherit' });

    // import.ts pulls in ../types, so tsc roots the output at src/ and the
    // emitted file lands under utils/.
    const file = join(outDir, 'utils', 'import.js');
    writeFileSync(
        file,
        readFileSync(file, 'utf8')
            .replace(/from '\.\/(\w+)'/g, "from './$1.js'")
            .replace(/from '\.\.\/([\w/]+)'/g, "from '../$1.js'"),
    );
    const typesIndex = join(outDir, 'types', 'index.js');
    writeFileSync(
        typesIndex,
        readFileSync(typesIndex, 'utf8').replace(/from '\.\/(\w+)'/g, "from './$1.js'"),
    );
}

const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok: !!ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

/* ------------------------------------------------------------- fixtures */

const PROTON_JSON = JSON.stringify({
    version: '1.31.5',
    vaults: {
        'vault-1': {
            name: 'Personal',
            items: [
                {
                    itemId: 'a',
                    state: 1,
                    data: {
                        metadata: { name: 'GitHub', note: 'work account' },
                        type: 'login',
                        content: {
                            itemEmail: 'ada@example.com',
                            itemUsername: 'ada-dev',
                            password: 'hunter2',
                            urls: ['https://github.com/login', 'https://gist.github.com'],
                            totpUri: 'otpauth://totp/GitHub:ada?secret=JBSWY3DPEHPK3PXP&issuer=GitHub',
                        },
                    },
                },
                {
                    itemId: 'b',
                    state: 2,
                    data: { metadata: { name: 'Deleted thing' }, type: 'login', content: {} },
                },
                {
                    itemId: 'c',
                    state: 1,
                    data: {
                        metadata: { name: 'Visa', note: '' },
                        type: 'creditCard',
                        content: {
                            cardholderName: 'Ada Lovelace',
                            number: '4111 1111 1111 1111',
                            verificationNumber: '123',
                            expirationDate: '09-2030',
                        },
                    },
                },
                {
                    itemId: 'd',
                    state: 1,
                    data: { metadata: { name: 'Recovery codes', note: 'abc\ndef' }, type: 'note', content: {} },
                },
                {
                    itemId: 'e',
                    state: 1,
                    data: { metadata: { name: 'An alias' }, type: 'alias', content: {} },
                },
            ],
        },
    },
});

// Deliberately nasty: BOM, quoted comma, embedded newline, escaped quote.
const BITWARDEN_CSV = '﻿'
    + 'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\n'
    + ',,login,"Bank, Inc.","line one\nline two",,0,https://www.bank.example.com/signin,ada@example.com,"pa""ss,word",JBSWY3DPEHPK3PXP\n'
    + ',,login,Forum,,,0,https://forum.example.org,ada_l,secret2,\n'
    + ',,note,Just a note,some text,,0,,,,\n';

const CHROME_CSV = 'name,url,username,password,note\n'
    + 'example.com,https://example.com/,ada@example.com,pw1,\n'
    + 'sub,https://mail.example.com/,ada,pw2,a note\n';

/* --------------------------------------------------------- zip + msgpack */

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function u16(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; }
function u32(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; }

/**
 * Minimal ZIP writer: one deflate entry per file, exactly the structure the
 * importer's central-directory reader expects. Good enough for fixtures.
 */
function buildZip(files) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const file of files) {
        const name = Buffer.from(file.name, 'utf8');
        const comp = deflateRawSync(file.data);
        const crc = crc32(file.data);

        const local = Buffer.concat([
            Buffer.of(0x50, 0x4b, 0x03, 0x04),
            u16(20), u16(0), u16(8), u16(0), u16(0),
            u32(crc), u32(comp.length), u32(file.data.length),
            u16(name.length), u16(0),
            name, comp,
        ]);
        locals.push(local);

        centrals.push(Buffer.concat([
            Buffer.of(0x50, 0x4b, 0x01, 0x02),
            u16(20), u16(20), u16(0), u16(8), u16(0), u16(0),
            u32(crc), u32(comp.length), u32(file.data.length),
            u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0),
            u32(offset),
            name,
        ]));
        offset += local.length;
    }

    const central = Buffer.concat(centrals);
    const eocd = Buffer.concat([
        Buffer.of(0x50, 0x4b, 0x05, 0x06),
        u16(0), u16(0), u16(files.length), u16(files.length),
        u32(central.length), u32(offset), u16(0),
    ]);
    return Buffer.concat([...locals, central, eocd]);
}

/* MessagePack encoder, only the subset the Proton passkey fixture needs. */
function mpStr(s) {
    const b = Buffer.from(s, 'utf8');
    if (b.length > 31) throw new Error('fixture encoder: fixstr overflow');
    return Buffer.concat([Buffer.of(0xa0 | b.length), b]);
}
function mpBin(bytes) {
    return Buffer.concat([Buffer.of(0xc4, bytes.length), bytes]);
}
function mpInt(v) {
    if (v >= 0 && v <= 0x7f) return Buffer.of(v);
    if (v < 0 && v >= -32) return Buffer.of(0x100 + v);
    throw new Error('fixture encoder: unsupported int ' + v);
}
function mpMap(pairs) {
    if (pairs.length > 15) throw new Error('fixture encoder: fixmap overflow');
    return Buffer.concat([Buffer.of(0x80 | pairs.length), ...pairs.flatMap(([k, v]) => [k, v])]);
}
function mpArr(items) {
    if (items.length > 15) throw new Error('fixture encoder: fixarray overflow');
    return Buffer.concat([Buffer.of(0x90 | items.length), ...items]);
}

/**
 * Builds a Proton passkey `content` payload: base64 of MessagePack wrapping
 * MessagePack, whose inner map carries a passkey-rs COSE key as `par` pairs
 * (-2: x, -3: y, -4: d) plus `cid` and `uhd` — the structure the real export
 * uses, verified against a live Proton archive.
 */
async function buildProtonPasskeyFixture() {
    const kp = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
    );
    const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    const x = Buffer.from(jwk.x, 'base64url');
    const y = Buffer.from(jwk.y, 'base64url');
    const d = Buffer.from(jwk.d, 'base64url');
    const cid = Buffer.from('0123456789abcdef0123456789abcdef', 'utf8');
    const uhd = Buffer.from('user-handle-16', 'utf8');

    const coord = (label, bytes) => mpArr([
        mpMap([[mpStr('c'), mpInt(label)]]),
        mpMap([[mpStr('c'), mpBin(bytes)]]),
    ]);
    const par = mpArr([
        coord(-2, x), coord(-3, y), coord(-4, d),
    ]);
    const inner = mpMap([
        [mpStr('key'), mpMap([[mpStr('par'), par]])],
        [mpStr('cid'), mpBin(cid)],
        [mpStr('uhd'), mpBin(uhd)],
    ]);
    const outer = mpMap([[mpStr('c'), mpBin(inner)]]);

    return {
        keypair: kp,
        expectedCid: cid,
        record: {
            content: outer.toString('base64'),
            rpId: 'test.example',
            rpName: 'Test Site',
            userName: 'ada@example.com',
            userDisplayName: 'Ada',
            createTime: 1700000000,
        },
    };
}

/* ----------------------------------------------------------------- main */

async function main() {
    build();
    const { parseProtonJson, parseCsvExport, parseImportFile, parseCsv, markDuplicates, parseImportInput } =
        await import(pathToFileURL(join(outDir, 'utils', 'import.js')).href);
    const { vaultItemsToCsv } =
        await import(pathToFileURL(join(outDir, 'utils', 'export.js')).href);

    const passkeyFixture = await buildProtonPasskeyFixture();

    // The ZIP fixture carries the same vault plus one login with a passkey,
    // under the archive layout Proton actually ships.
    const ZIP_JSON = JSON.stringify({
        version: '1.31.5',
        vaults: {
            'vault-1': {
                name: 'Personal',
                items: [
                    {
                        itemId: 'pk-1',
                        state: 1,
                        data: {
                            metadata: { name: 'Test Site' },
                            type: 'login',
                            content: {
                                itemEmail: 'ada@example.com',
                                password: 'hunter2',
                                urls: ['https://test.example'],
                                passkeys: [passkeyFixture.record],
                            },
                        },
                    },
                ],
            },
        },
    });
    const zipBytes = new Uint8Array(buildZip([
        { name: 'Proton Pass/data.json', data: Buffer.from(ZIP_JSON, 'utf8') },
    ]));

    /* --- Proton -------------------------------------------------------- */
    const proton = parseProtonJson(PROTON_JSON);
    const logins = proton.candidates.filter(c => c.itemType === 'login');
    const github = logins.find(c => c.metadata.label === 'GitHub');

    check('proton: parsed', proton.sourceLabel === 'Proton Pass');
    check('proton: login imported', !!github);
    check('proton: email kept separate from username',
        github.data.email === 'ada@example.com' && github.data.username === 'ada-dev',
        `email=${github.data.email} username=${github.data.username}`);
    check('proton: url stored without protocol', github.data.url === 'github.com/login', github.data.url);
    check('proton: otpauth:// reduced to the secret',
        github.data.totpSecret === 'JBSWY3DPEHPK3PXP', github.data.totpSecret);
    check('proton: second URL became its own entry',
        logins.some(c => c.data.url === 'gist.github.com'),
        logins.map(c => c.data.url).join(' | '));
    check('proton: trashed item skipped',
        !proton.candidates.some(c => c.metadata.label === 'Deleted thing')
        && proton.skipped.some(s => /trash/i.test(s.reason)));
    check('proton: card imported with split expiry', (() => {
        const card = proton.candidates.find(c => c.itemType === 'card');
        return card && card.data.cardNumber === '4111111111111111'
            && card.data.expiryMonth === '09' && card.data.expiryYear === '2030';
    })());
    check('proton: note imported', proton.candidates.some(c => c.metadata.tags.includes('note')));
    check('proton: unsupported type reported, not dropped silently',
        proton.skipped.some(s => /alias/i.test(s.reason)),
        proton.skipped.map(s => s.reason).join(' | '));

    /* --- CSV edge cases ------------------------------------------------ */
    const rows = parseCsv(BITWARDEN_CSV);
    check('csv: BOM stripped from first header', rows[0][0] === 'folder', JSON.stringify(rows[0][0]));
    check('csv: quoted comma kept in one field', rows[1][3] === 'Bank, Inc.', rows[1][3]);
    check('csv: embedded newline preserved', rows[1][4] === 'line one\nline two', JSON.stringify(rows[1][4]));
    check('csv: escaped quote unescaped', rows[1][9] === 'pa"ss,word', rows[1][9]);
    check('csv: row count correct (no split on inner newline)', rows.length === 4, `${rows.length} rows`);

    const bitwarden = parseCsvExport(BITWARDEN_CSV);
    check('bitwarden: detected', bitwarden.sourceLabel === 'Bitwarden', bitwarden.sourceLabel);
    check('bitwarden: two logins, note skipped',
        bitwarden.candidates.length === 2 && bitwarden.skipped.length === 1,
        `${bitwarden.candidates.length} candidates, ${bitwarden.skipped.length} skipped`);

    const bank = bitwarden.candidates[0];
    check('bitwarden: www stripped from stored url',
        bank.data.url === 'bank.example.com/signin', bank.data.url);
    check('bitwarden: email-shaped identifier routed to email',
        bank.data.email === 'ada@example.com' && bank.data.username === '');
    check('bitwarden: non-email identifier routed to username', (() => {
        const forum = bitwarden.candidates[1];
        return forum.data.username === 'ada_l' && forum.data.email === '';
    })());
    check('bitwarden: raw base32 totp kept', bank.data.totpSecret === 'JBSWY3DPEHPK3PXP');

    /* --- Chrome + subdomains ------------------------------------------- */
    const chrome = parseCsvExport(CHROME_CSV);
    check('chrome: detected', chrome.sourceLabel === 'Chrome / Edge', chrome.sourceLabel);
    check('chrome: subdomain preserved, not flattened',
        chrome.candidates[1].data.url === 'mail.example.com'
        && chrome.candidates[1].metadata.domain === 'mail.example.com',
        chrome.candidates[1].data.url);

    /* --- dispatch ------------------------------------------------------- */
    check('dispatch: .json routed to Proton', parseImportFile('x.json', PROTON_JSON).source === 'proton');
    check('dispatch: .csv routed to CSV', parseImportFile('x.csv', CHROME_CSV).source === 'chrome');
    check('dispatch: content sniffed when extension is wrong',
        parseImportFile('export.dat', PROTON_JSON).source === 'proton');

    /* --- dedupe ---------------------------------------------------------- */
    const existing = [{
        id: 'existing-1',
        itemType: 'login',
        data: { url: 'bank.example.com/signin', username: '', email: 'ada@example.com', password: 'old' },
        metadata: { label: 'Bank', domain: 'bank.example.com', tags: [], favorite: false },
    }];
    const marked = markDuplicates(bitwarden.candidates, existing);
    check('dedupe: existing record flagged', marked[0].duplicateOfId === 'existing-1', marked[0].duplicateOfId);
    check('dedupe: new record not flagged', marked[1].duplicateOfId === undefined);

    /* --- failure modes ---------------------------------------------------- */
    let threw = '';
    try { parseCsvExport('just,some,columns\n1,2,3\n'); } catch (e) { threw = e.message; }
    check('unrecognised CSV fails loudly', /no password column/i.test(threw), threw);

    threw = '';
    try { parseProtonJson('{"nope":true}'); } catch (e) { threw = e.message; }
    check('non-Proton JSON fails loudly', /vaults/i.test(threw), threw);

    /* --- Proton ZIP archive ---------------------------------------------- */
    const fromZip = await parseImportInput('Pass_export.zip', zipBytes);
    check('zip: routed to Proton', fromZip.source === 'proton', fromZip.source);
    check('zip: login imported', fromZip.candidates.some(c =>
        c.itemType === 'login' && c.data.email === 'ada@example.com'));

    const pkCandidate = fromZip.candidates.find(c => c.itemType === 'passkey');
    check('zip: passkey recovered', !!pkCandidate,
        fromZip.skipped.map(s => `${s.reason}: ${s.detail}`).join(' | '));

    if (pkCandidate) {
        const pk = pkCandidate.data;
        check('zip: passkey rpId and label',
            pk.rpId === 'test.example' && pkCandidate.metadata.domain === 'test.example',
            `${pk.rpId} / ${pkCandidate.metadata.label}`);
        check('zip: credentialId matches fixture bytes',
            Buffer.from(pk.credentialId, 'base64url').equals(passkeyFixture.expectedCid));

        // The recovered key must actually work: import both halves into
        // WebCrypto and round-trip a signature.
        const privKey = await crypto.subtle.importKey(
            'pkcs8', Buffer.from(pk.privateKey, 'base64url'),
            { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
        );
        const pubKey = await crypto.subtle.importKey(
            'spki', Buffer.from(pk.publicKey, 'base64url'),
            { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'],
        );
        const message = new Uint8Array([1, 2, 3, 4]);
        const signature = await crypto.subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' }, privKey, message,
        );
        const verified = await crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' }, pubKey, signature, message,
        );
        check('zip: passkey signs and verifies (ES256)', verified);
        check('zip: passkey userHandle carried through',
            Buffer.from(pk.userHandle, 'base64url').toString('utf8') === 'user-handle-16');
    }

    /* --- CSV export round-trip -------------------------------------------- */
    const exported = vaultItemsToCsv([{
        id: 'rt-1',
        itemType: 'login',
        data: {
            url: 'github.com/login',
            username: 'ada-dev',
            email: 'ada@example.com',
            password: 'hunter2',
            notes: 'work account',
            totpSecret: 'JBSWY3DPEHPK3PXP',
        },
        metadata: { label: 'GitHub', domain: 'github.com', tags: [], favorite: true },
        identityId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        authorDeviceId: 'device',
        deletedAt: null,
        lastUsedAt: null,
    }]);

    const roundTrip = parseCsvExport(exported);
    check('export: own CSV detected as Proton layout',
        roundTrip.source === 'proton', roundTrip.sourceLabel);
    const rt = roundTrip.candidates[0];
    check('export: login round-trips', !!rt &&
        rt.metadata.label === 'GitHub'
        && rt.data.url === 'github.com/login'
        && rt.data.email === 'ada@example.com'
        && rt.data.username === 'ada-dev'
        && rt.data.password === 'hunter2'
        && rt.data.notes === 'work account'
        && rt.data.totpSecret === 'JBSWY3DPEHPK3PXP',
        rt ? JSON.stringify(rt.data) : 'no candidate');
    check('export: favorite flag round-trips', rt?.metadata.favorite === true);

    const failed = results.filter(r => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) {
        console.log(`FAILED: ${failed.map(f => f.name).join(', ')}`);
        process.exitCode = 1;
    }
}

try {
    await main();
} finally {
    rmSync(outDir, { recursive: true, force: true });
}
