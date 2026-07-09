import { argon2id } from '@noble/hashes/argon2';
import { randomBytes } from '@noble/hashes/utils';

const SALT_SIZE = 16;
const KEY_SIZE = 32;

export function generateSalt(): Uint8Array {
    return randomBytes(SALT_SIZE);
}

export function deriveKeyFromPin(pin: string, salt: Uint8Array): Uint8Array {
    const params = {
        t: 3,
        m: 65536,
        p: 1,
        dkLen: KEY_SIZE,
    };
    const pinBytes = new TextEncoder().encode(pin);
    return argon2id(pinBytes, salt, params);
}

export function saltToBase64(salt: Uint8Array): string {
    return btoa(String.fromCharCode(...salt));
}

export function saltFromBase64(saltB64: string): Uint8Array {
    return Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
}
