import { gcm } from '@noble/ciphers/aes';
import { randomBytes } from '@noble/hashes/utils';

const KEY_SIZE = 32;
const NONCE_SIZE = 12;

export function generateSymmetricKey(): Uint8Array {
    return randomBytes(KEY_SIZE);
}

export function encrypt(plaintext: Uint8Array, key: Uint8Array): { ciphertext: Uint8Array; nonce: Uint8Array } {
    const nonce = randomBytes(NONCE_SIZE);
    const cipher = gcm(key, nonce);
    const ciphertext = cipher.encrypt(plaintext);
    return { ciphertext, nonce };
}

export function decrypt(ciphertext: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array {
    const cipher = gcm(key, nonce);
    return cipher.decrypt(ciphertext);
}

export function encryptString(plaintext: string, key: Uint8Array): { ciphertext: string; nonce: string } {
    const encoded = new TextEncoder().encode(plaintext);
    const { ciphertext, nonce } = encrypt(encoded, key);
    return {
        ciphertext: btoa(String.fromCharCode(...ciphertext)),
        nonce: btoa(String.fromCharCode(...nonce)),
    };
}

export function decryptString(ciphertextB64: string, nonceB64: string, key: Uint8Array): string {
    const ciphertext = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
    const nonce = Uint8Array.from(atob(nonceB64), c => c.charCodeAt(0));
    const decrypted = decrypt(ciphertext, nonce, key);
    return new TextDecoder().decode(decrypted);
}
