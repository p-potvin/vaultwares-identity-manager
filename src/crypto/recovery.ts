import { generateKemKeyPair, kemKeyPairToBase64, toBase64, fromBase64 } from './pqc';
import { generateSymmetricKey, encrypt, decrypt } from './symmetric';
import { generateSalt, saltToBase64, saltFromBase64, deriveKeyFromPin } from './kdf';
import type { RecoveryKit } from '../types';

export function generateRecoveryKit(masterKey: Uint8Array, pin: string): RecoveryKit {
    const kemKp = generateKemKeyPair();
    const salt = generateSalt();
    const derivedKey = deriveKeyFromPin(pin, salt);

    const { ciphertext, nonce } = encrypt(masterKey, derivedKey);

    return {
        version: 1,
        kemPublicKey: toBase64(kemKp.publicKey),
        kemSecretKey: toBase64(kemKp.secretKey),
        wrappedMasterKey: toBase64(ciphertext) + ':' + toBase64(nonce),
        salt: saltToBase64(salt),
        createdAt: new Date().toISOString(),
    };
}

export function exportRecoveryKit(kit: RecoveryKit): string {
    return btoa(JSON.stringify(kit));
}

export function parseRecoveryKit(encoded: string): RecoveryKit {
    const json = atob(encoded);
    const kit = JSON.parse(json) as RecoveryKit;
    if (kit.version !== 1) {
        throw new Error(`Unsupported recovery kit version: ${kit.version}`);
    }
    return kit;
}

export function recoverMasterKey(kit: RecoveryKit, pin: string): Uint8Array {
    const salt = saltFromBase64(kit.salt);
    const derivedKey = deriveKeyFromPin(pin, salt);

    const parts = kit.wrappedMasterKey.split(':');
    if (parts.length !== 2) throw new Error('Invalid wrapped master key format');

    const ciphertext = fromBase64(parts[0]);
    const nonce = fromBase64(parts[1]);

    return decrypt(ciphertext, nonce, derivedKey);
}

export function downloadRecoveryKit(kit: RecoveryKit): void {
    const encoded = exportRecoveryKit(kit);
    const blob = new Blob([encoded], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vaultwares-recovery-kit-${new Date().toISOString().split('T')[0]}.vwrecovery`;
    a.click();
    URL.revokeObjectURL(url);
}
