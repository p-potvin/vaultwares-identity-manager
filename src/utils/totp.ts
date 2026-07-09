import { hmac } from '@noble/hashes/hmac';
import { sha1 } from '@noble/hashes/sha1';
import { sha256, sha512 } from '@noble/hashes/sha2';

function base32Decode(secret: string): Uint8Array {
    const cleaned = secret.replace(/\s/g, '').replace(/=/g, '').toUpperCase();
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes: number[] = [];
    let buffer = 0;
    let bitsLeft = 0;

    for (const char of cleaned) {
        const idx = alphabet.indexOf(char);
        if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
        buffer = (buffer << 5) | idx;
        bitsLeft += 5;
        if (bitsLeft >= 8) {
            bytes.push((buffer >> (bitsLeft - 8)) & 0xff);
            bitsLeft -= 8;
        }
    }
    return new Uint8Array(bytes);
}

export function generateTotpCode(
    secret: string,
    options: { digits?: number; period?: number; algorithm?: 'SHA1' | 'SHA256' | 'SHA512' } = {},
): string {
    const digits = options.digits ?? 6;
    const period = options.period ?? 30;
    const algorithm = options.algorithm ?? 'SHA1';

    const key = base32Decode(secret);
    let counter = Math.floor(Date.now() / 1000 / period);
    const counterBytes = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) {
        counterBytes[i] = counter & 0xff;
        counter = Math.floor(counter / 256);
    }

    const hashFn = algorithm === 'SHA256' ? sha256 : algorithm === 'SHA512' ? sha512 : sha1;
    const hmacResult = hmac(hashFn, key, counterBytes);

    const offset = hmacResult[hmacResult.length - 1] & 0x0f;
    const binary =
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);

    const code = binary % Math.pow(10, digits);
    return code.toString().padStart(digits, '0');
}

export function getTotpRemainingSeconds(period: number = 30): number {
    return period - (Math.floor(Date.now() / 1000) % period);
}

export function parseTotpUri(uri: string): { secret: string; issuer?: string; label?: string; digits: number; period: number; algorithm: 'SHA1' | 'SHA256' | 'SHA512' } {
    if (!uri.startsWith('otpauth://totp/')) {
        throw new Error('Invalid TOTP URI');
    }
    const url = new URL(uri);
    const label = decodeURIComponent(url.pathname.slice(1));
    const params = url.searchParams;
    const secret = params.get('secret') ?? '';
    const issuer = params.get('issuer') ?? undefined;
    const digits = parseInt(params.get('digits') ?? '6', 10);
    const period = parseInt(params.get('period') ?? '30', 10);
    const algorithm = (params.get('algorithm') ?? 'SHA1').toUpperCase() as 'SHA1' | 'SHA256' | 'SHA512';

    return { secret, issuer, label, digits, period, algorithm };
}
