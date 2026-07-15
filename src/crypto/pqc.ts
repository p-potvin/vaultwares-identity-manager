import { ml_kem768 } from '@noble/post-quantum/ml-kem';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa';
import { randomBytes } from '@noble/hashes/utils';
import type { PQCKeyPair, PQCKeyPairBase64 } from '../types';

export function toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function fromBase64(str: string): Uint8Array {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export function generateKemKeyPair(): PQCKeyPair {
    const { publicKey, secretKey } = ml_kem768.keygen();
    return { publicKey, secretKey };
}

export function encapsulate(publicKey: Uint8Array): { ciphertext: Uint8Array; sharedSecret: Uint8Array } {
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(publicKey);
    return { ciphertext: cipherText, sharedSecret };
}

export function decapsulate(secretKey: Uint8Array, ciphertext: Uint8Array): Uint8Array {
    // @noble/post-quantum 0.2.x takes (cipherText, secretKey) in this order.
    return ml_kem768.decapsulate(ciphertext, secretKey);
}

export function generateSigKeyPair(): PQCKeyPair {
    // Must use fresh randomness. A fixed seed makes every install share one
    // signing key, so signatures would prove nothing.
    const { publicKey, secretKey } = ml_dsa65.keygen(randomBytes(32));
    return { publicKey, secretKey };
}

/**
 * Deterministic JSON serialization (keys sorted at every level) so that a
 * signature computed over an object verifies regardless of property order or
 * the serializer used on the other side.
 */
export function canonicalJSON(value: any): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
    const keys = Object.keys(value).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJSON(value[k])).join(',') + '}';
}

export function sign(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
    return ml_dsa65.sign(secretKey, message);
}

export function verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
    return ml_dsa65.verify(publicKey, message, signature);
}

export function kemKeyPairToBase64(kp: PQCKeyPair): PQCKeyPairBase64 {
    return { publicKey: toBase64(kp.publicKey), secretKey: toBase64(kp.secretKey) };
}

export function sigKeyPairToBase64(kp: PQCKeyPair): PQCKeyPairBase64 {
    return { publicKey: toBase64(kp.publicKey), secretKey: toBase64(kp.secretKey) };
}

export function kemKeyPairFromBase64(kp: PQCKeyPairBase64): PQCKeyPair {
    return { publicKey: fromBase64(kp.publicKey), secretKey: fromBase64(kp.secretKey) };
}

export function sigKeyPairFromBase64(kp: PQCKeyPairBase64): PQCKeyPair {
    return { publicKey: fromBase64(kp.publicKey), secretKey: fromBase64(kp.secretKey) };
}
