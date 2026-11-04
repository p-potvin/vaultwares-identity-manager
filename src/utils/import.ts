/**
 * Importers for other password managers.
 *
 * Parsing happens entirely in the extension: an export file is the most
 * sensitive document a person owns, and uploading one to be converted would
 * undo the point of a zero-knowledge vault. Nothing here touches the network.
 *
 * Everything returns `ParsedImport` so the UI can show a preview and let the
 * user commit or cancel — an import that silently writes hundreds of records is
 * not something you can undo.
 */

import type { ItemType, LoginItem, CardItem, AddressItem, TotpItem, PasskeyItem, VaultItemData, VaultItemMetadata } from '../types';
import { getHost, normalizeStoredUrl } from './domain';
import { base64urlToBytes, bytesToBase64url, COSE_ALG_ES256 } from '../webauthn/encoding';

export type ImportSource = 'proton' | 'bitwarden' | 'chrome' | 'lastpass' | 'onepassword' | 'csv';

export interface ImportCandidate {
    itemType: ItemType;
    data: VaultItemData;
    metadata: VaultItemMetadata;
    /** Set when an existing vault item looks like the same record. */
    duplicateOfId?: string;
}

export interface ParsedImport {
    source: ImportSource;
    sourceLabel: string;
    candidates: ImportCandidate[];
    /** Rows that could not be understood, with the reason, so nothing vanishes silently. */
    skipped: { reason: string; detail: string }[];
}

/* ----------------------------------------------------------- zip extractor */

export interface ExtractedZipEntry {
    name: string;
    bytes: Uint8Array;
    text(): string;
}

/**
 * Pure TypeScript ZIP reader using the Central Directory and native
 * `DecompressionStream('deflate-raw')` for Proton Pass `.zip` archives.
 */
export async function extractZipFiles(buffer: ArrayBuffer | Uint8Array): Promise<Record<string, ExtractedZipEntry>> {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    let eocdOffset = -1;
    const minEocdSearch = Math.max(0, bytes.length - 65557);
    for (let i = bytes.length - 22; i >= minEocdSearch; i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
            eocdOffset = i;
            break;
        }
    }

    if (eocdOffset === -1) {
        throw new Error('Invalid ZIP archive: End of Central Directory signature not found.');
    }

    const cdOffset = view.getUint32(eocdOffset + 16, true);
    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const decoder = new TextDecoder('utf-8');
    const files: Record<string, ExtractedZipEntry> = {};

    let pos = cdOffset;
    for (let entryIndex = 0; entryIndex < totalEntries; entryIndex++) {
        if (pos + 46 > bytes.length) break;
        const signature = view.getUint32(pos, true);
        if (signature !== 0x02014b50) break;

        const compMethod = view.getUint16(pos + 10, true);
        const compSize = view.getUint32(pos + 20, true);
        const nameLen = view.getUint16(pos + 28, true);
        const extraLen = view.getUint16(pos + 30, true);
        const commentLen = view.getUint16(pos + 32, true);
        const localHeaderOffset = view.getUint32(pos + 42, true);

        const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));

        if (localHeaderOffset + 30 <= bytes.length) {
            const localNameLen = view.getUint16(localHeaderOffset + 26, true);
            const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
            const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
            const compressedData = bytes.subarray(dataStart, dataStart + compSize);

            let uncompressedBytes: Uint8Array;
            if (compMethod === 0) {
                uncompressedBytes = compressedData;
            } else if (compMethod === 8) {
                if (typeof DecompressionStream === 'undefined') {
                    throw new Error('DecompressionStream is not supported in this runtime.');
                }
                const ds = new DecompressionStream('deflate-raw');
                const writer = ds.writable.getWriter();
                writer.write(compressedData as unknown as BufferSource);
                writer.close();

                const reader = ds.readable.getReader();
                const chunks: Uint8Array[] = [];
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (value) chunks.push(value);
                }

                const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
                uncompressedBytes = new Uint8Array(totalLength);
                let writePos = 0;
                for (const chunk of chunks) {
                    uncompressedBytes.set(chunk, writePos);
                    writePos += chunk.length;
                }
            } else {
                throw new Error(`Unsupported ZIP compression method: ${compMethod}`);
            }

            files[name] = {
                name,
                bytes: uncompressedBytes,
                text() {
                    return decoder.decode(uncompressedBytes);
                },
            };
        }

        pos += 46 + nameLen + extraLen + commentLen;
    }

    return files;
}

/* ------------------------------------------------ proton passkey converter */

/**
 * Minimal MessagePack decoder for Proton Pass `passkeys[].content` payloads.
 */
function decodeMsgPack(bytes: Uint8Array, offset = 0): [any, number] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const b = bytes[offset++];
    if (b <= 0x7f) return [b, offset];
    if (b >= 0xe0) return [b - 256, offset];
    if ((b & 0xf0) === 0x80) {
        const n = b & 0x0f;
        const obj: Record<string, any> = {};
        for (let i = 0; i < n; i++) {
            let k: any, v: any;
            [k, offset] = decodeMsgPack(bytes, offset);
            [v, offset] = decodeMsgPack(bytes, offset);
            obj[String(k)] = v;
        }
        return [obj, offset];
    }
    if ((b & 0xf0) === 0x90) {
        const n = b & 0x0f;
        const arr: any[] = [];
        for (let i = 0; i < n; i++) {
            let v: any;
            [v, offset] = decodeMsgPack(bytes, offset);
            arr.push(v);
        }
        return [arr, offset];
    }
    if ((b & 0xe0) === 0xa0) {
        const n = b & 0x1f;
        const s = new TextDecoder('utf-8').decode(bytes.subarray(offset, offset + n));
        return [s, offset + n];
    }
    if (b === 0xc0) return [null, offset];
    if (b === 0xc2) return [false, offset];
    if (b === 0xc3) return [true, offset];
    if (b === 0xc4) {
        const n = bytes[offset++];
        return [bytes.subarray(offset, offset + n), offset + n];
    }
    if (b === 0xc5) {
        const n = view.getUint16(offset, false);
        offset += 2;
        return [bytes.subarray(offset, offset + n), offset + n];
    }
    if (b === 0xcc) return [bytes[offset++], offset];
    if (b === 0xcd) {
        const v = view.getUint16(offset, false);
        offset += 2;
        return [v, offset];
    }
    if (b === 0xce) {
        const v = view.getUint32(offset, false);
        offset += 4;
        return [v, offset];
    }
    if (b === 0xd0) return [view.getInt8(offset++), offset];
    if (b === 0xd1) {
        const v = view.getInt16(offset, false);
        offset += 2;
        return [v, offset];
    }
    if (b === 0xd2) {
        const v = view.getInt32(offset, false);
        offset += 4;
        return [v, offset];
    }
    if (b === 0xd9) {
        const n = bytes[offset++];
        const s = new TextDecoder('utf-8').decode(bytes.subarray(offset, offset + n));
        return [s, offset + n];
    }
    if (b === 0xda) {
        const n = view.getUint16(offset, false);
        offset += 2;
        const s = new TextDecoder('utf-8').decode(bytes.subarray(offset, offset + n));
        return [s, offset + n];
    }
    if (b === 0xdc) {
        const n = view.getUint16(offset, false);
        offset += 2;
        const arr: any[] = [];
        for (let i = 0; i < n; i++) {
            let v: any;
            [v, offset] = decodeMsgPack(bytes, offset);
            arr.push(v);
        }
        return [arr, offset];
    }
    if (b === 0xde) {
        const n = view.getUint16(offset, false);
        offset += 2;
        const obj: Record<string, any> = {};
        for (let i = 0; i < n; i++) {
            let k: any, v: any;
            [k, offset] = decodeMsgPack(bytes, offset);
            [v, offset] = decodeMsgPack(bytes, offset);
            obj[String(k)] = v;
        }
        return [obj, offset];
    }
    throw new Error(`Unsupported MessagePack tag 0x${b.toString(16)}`);
}

const P256_PKCS8_PREFIX = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20,
]);

const P256_PKCS8_MID = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00, 0x04,
]);

const P256_SPKI_PREFIX = new Uint8Array([
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a,
    0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03,
    0x42, 0x00, 0x04,
]);

function toByteArray(val: unknown): Uint8Array | null {
    if (val instanceof Uint8Array) return val;
    if (Array.isArray(val) && val.every(n => typeof n === 'number')) {
        return new Uint8Array(val);
    }
    return null;
}

export interface ProtonPasskeyRaw {
    keyId?: string;
    content?: string;
    domain?: string;
    rpId?: string;
    rpName?: string;
    userName?: string;
    userDisplayName?: string;
    userId?: string;
    createTime?: number;
    note?: string;
    credentialId?: string;
    userHandle?: string;
}

/**
 * Extracts a usable ES256 (ECDSA P-256) WebAuthn passkey from a Proton Pass
 * exported passkey record. Proton stores the passkey as base64 MessagePack
 * wrapping a passkey-rs COSE_Key with P-256 coordinates (-2: x, -3: y, -4: d).
 */
export function parseProtonPasskey(pk: ProtonPasskeyRaw, fallbackLabel?: string): ImportCandidate | null {
    if (!pk.content) return null;

    const rawBytes = base64urlToBytes(pk.content);
    const [outer] = decodeMsgPack(rawBytes, 0);
    const innerBytes = toByteArray(outer?.c);
    if (!innerBytes) return null;

    const [inner] = decodeMsgPack(innerBytes, 0);
    const par: unknown[] | undefined = inner?.key?.par;
    if (!Array.isArray(par)) return null;

    const getCoord = (labelInt: number): Uint8Array | null => {
        for (const entry of par) {
            if (Array.isArray(entry) && entry[0]?.c === labelInt) {
                return toByteArray(entry[1]?.c);
            }
        }
        return null;
    };

    const x = getCoord(-2);
    const y = getCoord(-3);
    const d = getCoord(-4);
    if (!x || !y || !d || x.length !== 32 || y.length !== 32 || d.length !== 32) {
        return null;
    }

    const pkcs8 = new Uint8Array(P256_PKCS8_PREFIX.length + 32 + P256_PKCS8_MID.length + 64);
    let offset = 0;
    pkcs8.set(P256_PKCS8_PREFIX, offset); offset += P256_PKCS8_PREFIX.length;
    pkcs8.set(d, offset); offset += 32;
    pkcs8.set(P256_PKCS8_MID, offset); offset += P256_PKCS8_MID.length;
    pkcs8.set(x, offset); offset += 32;
    pkcs8.set(y, offset);

    const spki = new Uint8Array(P256_SPKI_PREFIX.length + 64);
    spki.set(P256_SPKI_PREFIX, 0);
    spki.set(x, P256_SPKI_PREFIX.length);
    spki.set(y, P256_SPKI_PREFIX.length + 32);

    const cidBytes = toByteArray(inner?.cid) ?? (pk.credentialId ? base64urlToBytes(pk.credentialId) : null);
    if (!cidBytes || cidBytes.length === 0) return null;

    const uhdBytes = toByteArray(inner?.uhd) ?? (pk.userHandle ? base64urlToBytes(pk.userHandle) : new Uint8Array(0));
    const rpId = (pk.rpId || inner?.rid || getHost(pk.domain || '')).toLowerCase();
    if (!rpId) return null;

    const rpName = pk.rpName || fallbackLabel || rpId;
    const userName = pk.userName || '';
    const userDisplayName = pk.userDisplayName || userName;

    const passkeyData: PasskeyItem = {
        rpId,
        rpName,
        credentialId: bytesToBase64url(cidBytes),
        privateKey: bytesToBase64url(pkcs8),
        publicKey: bytesToBase64url(spki),
        userHandle: uhdBytes.length > 0 ? bytesToBase64url(uhdBytes) : '',
        userName,
        userDisplayName,
        algorithm: COSE_ALG_ES256,
        createdByAuthenticator: true,
        createdAt: pk.createTime ? new Date(pk.createTime * 1000).toISOString() : new Date().toISOString(),
        notes: pk.note || undefined,
    };

    return {
        itemType: 'passkey',
        data: passkeyData,
        metadata: {
            label: userName ? `${rpName} (${userName})` : rpName,
            domain: rpId,
            tags: ['imported', 'passkey'],
            favorite: false,
        },
    };
}

/* ------------------------------------------------------------------- csv */

/**
 * RFC 4180 parser. Hand-rolled because every export in the wild contains
 * quoted commas and embedded newlines in the notes column, and splitting on
 * commas mangles exactly the records people care most about keeping.
 */
export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    // Strip a UTF-8 BOM; Excel-produced exports carry one and it corrupts the
    // first header name.
    const input = text.replace(/^﻿/, '');

    for (let i = 0; i < input.length; i++) {
        const char = input[i];

        if (inQuotes) {
            if (char === '"') {
                if (input[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else {
                field += char;
            }
            continue;
        }

        if (char === '"') { inQuotes = true; continue; }
        if (char === ',') { row.push(field); field = ''; continue; }
        if (char === '\r') continue;
        if (char === '\n') {
            row.push(field);
            // Skip blank trailing lines rather than importing an empty record.
            if (row.length > 1 || row[0] !== '') rows.push(row);
            row = [];
            field = '';
            continue;
        }
        field += char;
    }

    if (field !== '' || row.length > 0) {
        row.push(field);
        if (row.length > 1 || row[0] !== '') rows.push(row);
    }
    return rows;
}

function headerIndex(headers: string[], ...names: string[]): number {
    const normalized = headers.map(h => h.trim().toLowerCase().replace(/[\s_-]/g, ''));
    for (const name of names) {
        const target = name.toLowerCase().replace(/[\s_-]/g, '');
        const index = normalized.indexOf(target);
        if (index >= 0) return index;
    }
    return -1;
}

function looksLikeEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Splits a single identifier column into the email/username pair the vault
 * stores. Exports almost always have one "username" column holding whichever
 * the user typed.
 */
function splitIdentifier(value: string): { email: string; username: string } {
    const trimmed = (value ?? '').trim();
    return looksLikeEmail(trimmed)
        ? { email: trimmed, username: '' }
        : { email: '', username: trimmed };
}

function loginCandidate(fields: {
    name?: string;
    url?: string;
    identifier?: string;
    email?: string;
    username?: string;
    password?: string;
    notes?: string;
    totp?: string;
    favorite?: boolean;
    tags?: string[];
}): ImportCandidate {
    const url = normalizeStoredUrl(fields.url ?? '');
    const host = getHost(fields.url ?? '');

    let email = (fields.email ?? '').trim();
    let username = (fields.username ?? '').trim();
    if (!email && !username && fields.identifier) {
        ({ email, username } = splitIdentifier(fields.identifier));
    }

    const data: LoginItem = {
        url,
        username,
        email,
        password: fields.password ?? '',
        notes: fields.notes || undefined,
        totpSecret: normalizeTotpSecret(fields.totp),
    };

    return {
        itemType: 'login',
        data,
        metadata: {
            label: (fields.name ?? '').trim() || host || email || username || 'Imported login',
            domain: host || undefined,
            tags: fields.tags ?? ['imported'],
            favorite: Boolean(fields.favorite),
        },
    };
}

/** Accepts a raw Base32 secret or a full `otpauth://` URI. */
function normalizeTotpSecret(value?: string): string | undefined {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return undefined;

    if (trimmed.toLowerCase().startsWith('otpauth://')) {
        try {
            const secret = new URL(trimmed).searchParams.get('secret');
            return secret ? secret.toUpperCase() : undefined;
        } catch {
            return undefined;
        }
    }
    return trimmed.replace(/\s/g, '').toUpperCase();
}

/* ---------------------------------------------------------------- proton */

interface ProtonExtraField {
    fieldName?: string;
    name?: string;
    type?: string;
    value?: string;
    data?: { content?: string; totpUri?: string };
}

interface ProtonItemContent {
    itemEmail?: string;
    itemUsername?: string;
    password?: string;
    urls?: string[];
    autofillUrls?: string[];
    totpUri?: string;
    passkeys?: ProtonPasskeyRaw[];
    cardholderName?: string;
    number?: string;
    verificationNumber?: string;
    expirationDate?: string;
    pin?: string;
    fullName?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    streetAddress?: string;
    zipOrPostalCode?: string;
    city?: string;
    stateOrProvince?: string;
    countryOrRegion?: string;
}

interface ProtonItem {
    itemId?: string;
    aliasEmail?: string | null;
    pinned?: boolean;
    data?: {
        metadata?: { name?: string; note?: string };
        type?: string;
        content?: ProtonItemContent;
        extraFields?: ProtonExtraField[];
    };
    state?: number;
}

/**
 * Proton Pass JSON export (`Pass_export_*.zip` -> `data.json`, or the plain
 * `.json` download).
 *
 * Proton splits the identifier into `itemEmail` and `itemUsername`, which maps
 * directly onto the vault's two fields — one of the reasons that split was
 * worth making.
 */
export function parseProtonJson(text: string): ParsedImport {
    const result: ParsedImport = {
        source: 'proton',
        sourceLabel: 'Proton Pass',
        candidates: [],
        skipped: [],
    };

    let parsed: { vaults?: Record<string, { name?: string; items?: ProtonItem[] }> };
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        throw new Error(`Not valid JSON: ${(e as Error).message}`);
    }

    const vaults = parsed.vaults ?? {};
    if (Object.keys(vaults).length === 0) {
        throw new Error('No "vaults" object found — is this a Proton Pass export?');
    }

    for (const vault of Object.values(vaults)) {
        const vaultTag = vault.name ? `vault:${vault.name}` : undefined;
        const baseTags = vaultTag ? ['imported', vaultTag] : ['imported'];

        for (const item of vault.items ?? []) {
            const data = item.data;
            const content = (data?.content && typeof data.content === 'object' && !Array.isArray(data.content))
                ? data.content
                : {};
            const name = data?.metadata?.name ?? '';
            let note = data?.metadata?.note ?? '';
            const favorite = Boolean(item.pinned);

            // state 0 is deleted, state 2 is Proton's trash.
            if (item.state === 0 || item.state === 2) {
                result.skipped.push({ reason: 'In Proton trash', detail: name || item.itemId || '' });
                continue;
            }

            let totpUri = content.totpUri ?? '';
            if (Array.isArray(data?.extraFields)) {
                const extraLines: string[] = [];
                for (const ef of data.extraFields) {
                    if (!ef || typeof ef !== 'object') continue;
                    const efVal = ef.value ?? ef.data?.totpUri ?? ef.data?.content ?? '';
                    if (ef.type === 'totp' && efVal && !totpUri) {
                        totpUri = String(efVal);
                    } else if (efVal) {
                        const label = ef.fieldName || ef.name || 'Custom';
                        extraLines.push(`${label}: ${efVal}`);
                    }
                }
                if (extraLines.length > 0) {
                    note = [note, ...extraLines].filter(Boolean).join('\n');
                }
            }

            // Extract any WebAuthn passkeys attached to the item.
            if (Array.isArray(content.passkeys)) {
                for (const pk of content.passkeys) {
                    try {
                        const passkeyCandidate = parseProtonPasskey(pk, name);
                        if (passkeyCandidate) {
                            passkeyCandidate.metadata.favorite = favorite;
                            passkeyCandidate.metadata.tags = [...baseTags, 'passkey'];
                            result.candidates.push(passkeyCandidate);
                        } else {
                            result.skipped.push({
                                reason: 'Passkey missing ES256 key material',
                                detail: name || pk.rpId || pk.domain || 'passkey',
                            });
                        }
                    } catch (e) {
                        result.skipped.push({
                            reason: `Passkey parse error: ${(e as Error).message}`,
                            detail: name || pk.rpId || 'passkey',
                        });
                    }
                }
            }

            switch (data?.type) {
                case 'login': {
                    const urlSet = new Set<string>();
                    for (const u of [...(content.urls ?? []), ...(content.autofillUrls ?? [])]) {
                        if (typeof u === 'string' && u.trim()) urlSet.add(u.trim());
                    }
                    const allUrls = Array.from(urlSet);

                    // If the login item was only a container for a passkey (no password,
                    // no username/email, no TOTP, no note), don't emit an empty login row.
                    const hasLoginFields = Boolean(
                        content.itemEmail || content.itemUsername || content.password || totpUri || note
                    );
                    if (!hasLoginFields && Array.isArray(content.passkeys) && content.passkeys.length > 0) {
                        break;
                    }

                    result.candidates.push(loginCandidate({
                        name,
                        url: allUrls[0] ?? '',
                        email: content.itemEmail,
                        username: content.itemUsername,
                        password: content.password,
                        notes: note,
                        totp: totpUri,
                        favorite,
                        tags: baseTags,
                    }));

                    // Proton keeps every URL on one item; the extras become
                    // their own entries so each host still matches.
                    for (const extra of allUrls.slice(1)) {
                        result.candidates.push(loginCandidate({
                            name: `${name || getHost(extra)} (${getHost(extra)})`,
                            url: extra,
                            email: content.itemEmail,
                            username: content.itemUsername,
                            password: content.password,
                            notes: note,
                            totp: totpUri,
                            favorite,
                            tags: baseTags,
                        }));
                    }
                    break;
                }
                case 'creditCard': {
                    const [month = '', year = ''] = (content.expirationDate ?? '').split(/[-/]/);
                    const cardNotes = [
                        note,
                        content.pin ? `PIN: ${content.pin}` : '',
                    ].filter(Boolean).join('\n');
                    const card: CardItem = {
                        holderName: content.cardholderName ?? '',
                        cardNumber: (content.number ?? '').replace(/\s/g, ''),
                        expiryMonth: month,
                        expiryYear: year,
                        cvv: content.verificationNumber ?? '',
                        notes: cardNotes || undefined,
                    };
                    result.candidates.push({
                        itemType: 'card',
                        data: card,
                        metadata: { label: name || 'Imported card', tags: baseTags, favorite },
                    });
                    break;
                }
                case 'identity': {
                    const fullName = (content.fullName ?? [content.firstName, content.middleName, content.lastName].filter(Boolean).join(' ')).trim();
                    const address: AddressItem = {
                        fullName: fullName || name || 'Imported identity',
                        street: content.streetAddress ?? '',
                        city: content.city ?? '',
                        state: content.stateOrProvince ?? '',
                        zipCode: content.zipOrPostalCode ?? '',
                        country: content.countryOrRegion ?? '',
                        phone: content.phoneNumber || undefined,
                    };
                    result.candidates.push({
                        itemType: 'address',
                        data: address,
                        metadata: {
                            label: name || fullName || 'Imported address',
                            tags: [...baseTags, 'identity'],
                            favorite,
                        },
                    });
                    break;
                }
                case 'alias': {
                    const aliasEmail = (item.aliasEmail || content.itemEmail || content.email || '').trim();
                    if (!aliasEmail) {
                        result.skipped.push({ reason: 'Empty Proton alias', detail: name });
                        break;
                    }
                    result.candidates.push(loginCandidate({
                        name: name || aliasEmail,
                        url: '',
                        email: aliasEmail,
                        password: '',
                        notes: note || 'Proton Pass Hide-my-email alias',
                        favorite,
                        tags: [...baseTags, 'alias'],
                    }));
                    break;
                }
                case 'note': {
                    // Stored as a login carrying only notes; the vault has no
                    // dedicated note type yet.
                    result.candidates.push({
                        itemType: 'login',
                        data: { url: '', username: '', email: '', password: '', notes: note } satisfies LoginItem,
                        metadata: { label: name || 'Imported note', tags: [...baseTags, 'note'], favorite },
                    });
                    break;
                }
                default:
                    result.skipped.push({
                        reason: `Unsupported Proton item type "${data?.type ?? 'unknown'}"`,
                        detail: name,
                    });
            }
        }
    }

    return result;
}

/* ------------------------------------------------------------ csv sources */

interface CsvLayout {
    source: ImportSource;
    label: string;
    /** Returns true when these headers identify this exporter. */
    detect: (headers: string[]) => boolean;
    build: (headers: string[], row: string[]) => ImportCandidate | null;
}

const CSV_LAYOUTS: CsvLayout[] = [
    {
        source: 'proton',
        label: 'Proton Pass CSV',
        detect: h => headerIndex(h, 'totp_uri', 'totp') >= 0
            && (headerIndex(h, 'vault') >= 0 || (headerIndex(h, 'email') >= 0 && headerIndex(h, 'username') >= 0)),
        build: (h, r) => {
            const type = (r[headerIndex(h, 'type')] ?? 'login').trim().toLowerCase();
            if (type && type !== 'login' && type !== 'alias' && type !== 'note') return null;
            const rawUrls = r[headerIndex(h, 'urls', 'url')] ?? '';
            const firstUrl = rawUrls.split(/[;\n]/)[0]?.trim() ?? '';
            const pinnedVal = (r[headerIndex(h, 'pinned', 'favorite')] ?? '').toLowerCase();
            return loginCandidate({
                name: r[headerIndex(h, 'title', 'name')],
                url: firstUrl,
                email: r[headerIndex(h, 'email')],
                username: r[headerIndex(h, 'username')],
                password: r[headerIndex(h, 'password')],
                notes: r[headerIndex(h, 'note', 'notes')],
                totp: r[headerIndex(h, 'totp_uri', 'totp')],
                favorite: pinnedVal === 'true' || pinnedVal === '1',
            });
        },
    },
    {
        source: 'bitwarden',
        label: 'Bitwarden',
        detect: h => headerIndex(h, 'login_uri') >= 0 && headerIndex(h, 'login_password') >= 0,
        build: (h, r) => {
            if ((r[headerIndex(h, 'type')] ?? 'login') !== 'login') return null;
            return loginCandidate({
                name: r[headerIndex(h, 'name')],
                url: r[headerIndex(h, 'login_uri')],
                identifier: r[headerIndex(h, 'login_username')],
                password: r[headerIndex(h, 'login_password')],
                notes: r[headerIndex(h, 'notes')],
                totp: r[headerIndex(h, 'login_totp')],
            });
        },
    },
    {
        source: 'chrome',
        label: 'Chrome / Edge',
        detect: h => headerIndex(h, 'name') >= 0 && headerIndex(h, 'url') >= 0
            && headerIndex(h, 'username') >= 0 && headerIndex(h, 'password') >= 0
            && headerIndex(h, 'login_uri') < 0,
        build: (h, r) => loginCandidate({
            name: r[headerIndex(h, 'name')],
            url: r[headerIndex(h, 'url')],
            identifier: r[headerIndex(h, 'username')],
            password: r[headerIndex(h, 'password')],
            notes: r[headerIndex(h, 'note', 'notes')],
        }),
    },
    {
        source: 'lastpass',
        label: 'LastPass',
        detect: h => headerIndex(h, 'grouping') >= 0 && headerIndex(h, 'url') >= 0,
        build: (h, r) => loginCandidate({
            name: r[headerIndex(h, 'name')],
            url: r[headerIndex(h, 'url')],
            identifier: r[headerIndex(h, 'username')],
            password: r[headerIndex(h, 'password')],
            notes: r[headerIndex(h, 'extra', 'notes')],
            totp: r[headerIndex(h, 'totp')],
        }),
    },
    {
        source: 'onepassword',
        label: '1Password',
        detect: h => headerIndex(h, 'title') >= 0 && headerIndex(h, 'password') >= 0,
        build: (h, r) => loginCandidate({
            name: r[headerIndex(h, 'title')],
            url: r[headerIndex(h, 'url', 'website')],
            identifier: r[headerIndex(h, 'username')],
            password: r[headerIndex(h, 'password')],
            notes: r[headerIndex(h, 'notes')],
            totp: r[headerIndex(h, 'otpauth', 'onetimepassword')],
        }),
    },
];

/** Last resort for an unrecognised CSV: match on whatever columns exist. */
const GENERIC_LAYOUT: CsvLayout = {
    source: 'csv',
    label: 'Generic CSV',
    detect: () => true,
    build: (h, r) => {
        const password = r[headerIndex(h, 'password', 'pass', 'motdepasse')];
        if (password === undefined) return null;
        return loginCandidate({
            name: r[headerIndex(h, 'name', 'title', 'site', 'nom')],
            url: r[headerIndex(h, 'url', 'uri', 'website', 'login_uri', 'adresse')],
            email: r[headerIndex(h, 'email', 'courriel')],
            username: r[headerIndex(h, 'username', 'user', 'utilisateur')],
            password,
            notes: r[headerIndex(h, 'notes', 'note', 'extra')],
            totp: r[headerIndex(h, 'totp', 'otpauth', 'twofactor')],
        });
    },
};

export function parseCsvExport(text: string): ParsedImport {
    const rows = parseCsv(text);
    if (rows.length < 2) {
        throw new Error('The file has no data rows.');
    }

    const headers = rows[0];
    const layout = CSV_LAYOUTS.find(l => l.detect(headers)) ?? GENERIC_LAYOUT;

    const result: ParsedImport = {
        source: layout.source,
        sourceLabel: layout.label,
        candidates: [],
        skipped: [],
    };

    if (layout === GENERIC_LAYOUT && headerIndex(headers, 'password', 'pass', 'motdepasse') < 0) {
        throw new Error('No password column found. Supported: Proton Pass (.zip/.json/.csv), Bitwarden, Chrome, LastPass, 1Password CSV.');
    }

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.every(cell => cell.trim() === '')) continue;

        try {
            const candidate = layout.build(headers, row);
            if (candidate) result.candidates.push(candidate);
            else result.skipped.push({ reason: 'Not a login row', detail: row[0] ?? `row ${i + 1}` });
        } catch (e) {
            result.skipped.push({ reason: (e as Error).message, detail: row[0] ?? `row ${i + 1}` });
        }
    }

    return result;
}

/* --------------------------------------------------------------- dispatch */

export function parseImportFile(filename: string, text: string): ParsedImport {
    const lower = filename.toLowerCase();

    if (lower.endsWith('.json')) return parseProtonJson(text);
    if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) {
        return parseCsvExport(text);
    }

    // Fall back to sniffing content when the extension is missing or wrong.
    const trimmed = text.trimStart();
    if (trimmed.startsWith('{')) return parseProtonJson(text);
    return parseCsvExport(text);
}

/**
 * High-level import parser supporting Proton Pass `.zip` archives as well as
 * `.json` and `.csv` text files.
 */
export async function parseImportInput(
    filename: string,
    input: ArrayBuffer | Uint8Array | string,
): Promise<ParsedImport> {
    if (typeof input === 'string') {
        return parseImportFile(filename, input);
    }

    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const isZipMagic =
        bytes.length >= 4 &&
        bytes[0] === 0x50 &&
        bytes[1] === 0x4b &&
        bytes[2] === 0x03 &&
        bytes[3] === 0x04;

    if (isZipMagic || filename.toLowerCase().endsWith('.zip')) {
        const extracted = await extractZipFiles(bytes);
        const dataEntry =
            extracted['Proton Pass/data.json'] ??
            extracted['data.json'] ??
            Object.values(extracted).find(e => e.name.toLowerCase().endsWith('.json'));

        if (dataEntry) {
            return parseProtonJson(dataEntry.text());
        }

        const csvEntry = Object.values(extracted).find(e => e.name.toLowerCase().endsWith('.csv'));
        if (csvEntry) {
            return parseCsvExport(csvEntry.text());
        }

        throw new Error('No "data.json" or ".csv" file found inside the ZIP archive.');
    }

    const text = new TextDecoder('utf-8').decode(bytes);
    return parseImportFile(filename, text);
}

/* -------------------------------------------------------------- dedupe */

/**
 * Flags candidates that already exist, comparing host plus identifier for
 * logins and credentialId for passkeys.
 *
 * Marked rather than dropped: re-importing after adding entries by hand is
 * normal, and the user should see what will be skipped before it happens.
 */
export function markDuplicates(
    candidates: ImportCandidate[],
    existing: { id: string; itemType: ItemType; data: VaultItemData; metadata: VaultItemMetadata }[],
): ImportCandidate[] {
    const key = (host: string, identifier: string) => `${host.toLowerCase()}|${identifier.trim().toLowerCase()}`;

    const seenLogins = new Map<string, string>();
    const seenPasskeys = new Map<string, string>();

    for (const item of existing) {
        if (item.itemType === 'login') {
            const login = item.data as LoginItem;
            const host = getHost(login.url) || item.metadata.domain || '';
            for (const identifier of [login.email, login.username]) {
                if (identifier) seenLogins.set(key(host, identifier), item.id);
            }
        } else if (item.itemType === 'passkey') {
            const pk = item.data as PasskeyItem;
            if (pk.credentialId) {
                seenPasskeys.set(`${pk.rpId.toLowerCase()}|${pk.credentialId}`, item.id);
            }
        }
    }

    return candidates.map(candidate => {
        if (candidate.itemType === 'login') {
            const login = candidate.data as LoginItem;
            const host = getHost(login.url) || candidate.metadata.domain || '';
            for (const identifier of [login.email, login.username]) {
                if (!identifier) continue;
                const match = seenLogins.get(key(host, identifier));
                if (match) return { ...candidate, duplicateOfId: match };
            }
        } else if (candidate.itemType === 'passkey') {
            const pk = candidate.data as PasskeyItem;
            const match = seenPasskeys.get(`${pk.rpId.toLowerCase()}|${pk.credentialId}`);
            if (match) return { ...candidate, duplicateOfId: match };
        }
        return candidate;
    });
}

export type { TotpItem };
