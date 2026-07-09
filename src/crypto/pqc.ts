import { ml_kem768 } from '@noble/post-quantum/ml-kem';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa';
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
    return ml_kem768.decapsulate(secretKey, ciphertext);
}

export function generateSigKeyPair(): PQCKeyPair {
    const { publicKey, secretKey } = ml_dsa65.keygen(new Uint8Array(32));
    return { publicKey, secretKey };
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
