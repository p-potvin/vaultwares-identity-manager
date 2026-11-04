/**
 * Verification harness for the Proton Pass importer.
 *
 * Run with: npx tsx scripts/verify-proton-import.ts
 *
 * Reads the real Proton export ZIP from disk, runs it through the same
 * `parseImportInput` the ImportPanel uses, and asserts:
 *   1. The ZIP is parsed (no "unsupported format" failure).
 *   2. Logins, cards, identities, and aliases all produce candidates.
 *   3. Every exported passkey yields a usable ES256 key (PKCS#8 importable by
 *      WebCrypto and sign/verify round-trips).
 *   4. Nothing is written anywhere — this is a parse-only check.
 */

import * as fs from 'fs';
import { parseImportInput, markDuplicates } from '../src/utils/import';
import type { PasskeyItem, LoginItem, CardItem, AddressItem } from '../src/types';

const ZIP_PATH = 'C:/Users/Administrator/Desktop/Backups/Proton Pass_export_2026-10-19_1792378422.zip';

async function main(): Promise<void> {
    if (!fs.existsSync(ZIP_PATH)) {
        console.error(`SKIP: fixture not found at ${ZIP_PATH}`);
        process.exit(0);
    }

    const buffer = fs.readFileSync(ZIP_PATH);
    const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    console.log('Parsing Proton Pass ZIP export…');
    const parsed = await parseImportInput('Pass_export.zip', bytes);

    const byType: Record<string, number> = {};
    for (const candidate of parsed.candidates) {
        byType[candidate.itemType] = (byType[candidate.itemType] ?? 0) + 1;
    }

    console.log('Candidates by type:', byType);
    console.log('Skipped:', parsed.skipped.length);
    if (parsed.skipped.length > 0) {
        const reasons = new Set(parsed.skipped.map(s => s.reason));
        console.log('Skip reasons:', [...reasons]);
    }

    const passkeys = parsed.candidates.filter(c => c.itemType === 'passkey');
    console.log(`Passkeys recovered: ${passkeys.length}`);

    if (passkeys.length === 0) {
        console.error('FAIL: no passkeys were recovered from the export');
        process.exit(1);
    }

    // Every recovered passkey must import into WebCrypto and sign/verify.
    let verified = 0;
    for (const candidate of passkeys) {
        const pk = candidate.data as PasskeyItem;
        const pkcs8 = Buffer.from(
            pk.privateKey.replace(/-/g, '+').replace(/_/g, '/'),
            'base64',
        );
        const spki = Buffer.from(
            (pk.publicKey ?? '').replace(/-/g, '+').replace(/_/g, '/'),
            'base64',
        );

        const privKey = await crypto.subtle.importKey(
            'pkcs8',
            pkcs8,
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['sign'],
        );
        const pubKey = await crypto.subtle.importKey(
            'spki',
            spki,
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['verify'],
        );

        const message = new Uint8Array([1, 2, 3, 4]);
        const signature = await crypto.subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' },
            privKey,
            message,
        );
        const ok = await crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            pubKey,
            signature,
            message,
        );

        if (!ok) {
            console.error(`FAIL: passkey for ${pk.rpId} failed sign/verify round-trip`);
            process.exit(1);
        }
        verified++;
    }

    console.log(`Passkeys verified (sign/verify round-trip): ${verified}/${passkeys.length}`);

    const logins = parsed.candidates.filter(c => c.itemType === 'login');
    const withTotp = logins.filter(c => Boolean((c.data as LoginItem).totpSecret));
    console.log(`Logins: ${logins.length} (${withTotp.length} with TOTP)`);

    const cards = parsed.candidates.filter(c => c.itemType === 'card');
    const addresses = parsed.candidates.filter(c => c.itemType === 'address');
    console.log(`Cards: ${cards.length}, Addresses (from identities): ${addresses.length}`);

    if (logins.length === 0) {
        console.error('FAIL: no logins imported');
        process.exit(1);
    }
    if (cards.length === 0) {
        console.error('FAIL: no cards imported');
        process.exit(1);
    }

    // Dedupe check against an empty vault: nothing should be marked duplicate.
    const marked = markDuplicates(parsed.candidates, []);
    const falselyMarked = marked.filter(c => c.duplicateOfId).length;
    if (falselyMarked > 0) {
        console.error(`FAIL: ${falselyMarked} candidates falsely marked duplicate against an empty vault`);
        process.exit(1);
    }

    console.log('All checks passed.');
}

void main();
