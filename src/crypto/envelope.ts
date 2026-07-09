import { encrypt, decrypt, generateSymmetricKey } from './symmetric';
import { encapsulate, decapsulate, sign, verify, toBase64, fromBase64 } from './pqc';
import type { VaultEnvelope, VaultItem, EncryptedVaultItem, ItemType, VaultItemMetadata } from '../types';

function uuid(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function createEnvelope(
    item: VaultItem,
    kemPublicKey: Uint8Array,
    sigSecretKey: Uint8Array,
    deviceId: string,
): EncryptedVaultItem {
    const plaintext = new TextEncoder().encode(JSON.stringify(item.data));
    const itemKey = generateSymmetricKey();
    const { ciphertext, nonce } = encrypt(plaintext, itemKey);
    const { ciphertext: encapsulatedKey, sharedSecret } = encapsulate(kemPublicKey);

    const envelope: VaultEnvelope = {
        version: 1,
        itemType: item.itemType,
        ciphertext: toBase64(ciphertext),
        nonce: toBase64(nonce),
        encapsulatedKey: toBase64(encapsulatedKey),
        metadata: item.metadata,
        signature: '',
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        authorDeviceId: deviceId,
    };

    const signPayload = new TextEncoder().encode(
        envelope.ciphertext + envelope.nonce + JSON.stringify(envelope.metadata),
    );
    envelope.signature = toBase64(sign(signPayload, sigSecretKey));

    return { id: item.id, envelope, deletedAt: item.deletedAt };
}

export function openEnvelope(
    encryptedItem: EncryptedVaultItem,
    kemSecretKey: Uint8Array,
    sigPublicKey: Uint8Array,
): VaultItem {
    const { envelope } = encryptedItem;

    const signPayload = new TextEncoder().encode(
        envelope.ciphertext + envelope.nonce + JSON.stringify(envelope.metadata),
    );
    const signature = fromBase64(envelope.signature);
    if (!verify(signPayload, signature, sigPublicKey)) {
        throw new Error('Envelope signature verification failed');
    }

    const encapsulatedKey = fromBase64(envelope.encapsulatedKey);
    const itemKey = decapsulate(kemSecretKey, encapsulatedKey);

    const ciphertext = fromBase64(envelope.ciphertext);
    const nonce = fromBase64(envelope.nonce);
    const plaintext = decrypt(ciphertext, nonce, itemKey);

    const data = JSON.parse(new TextDecoder().decode(plaintext));

    return {
        id: encryptedItem.id,
        itemType: envelope.itemType as ItemType,
        data,
        metadata: envelope.metadata as VaultItemMetadata,
        createdAt: envelope.createdAt,
        updatedAt: envelope.updatedAt,
        authorDeviceId: envelope.authorDeviceId,
        deletedAt: encryptedItem.deletedAt,
    };
}

export function createVaultItem(
    itemType: ItemType,
    data: import('../types').VaultItemData,
    metadata: VaultItemMetadata,
    deviceId: string,
): VaultItem {
    const now = new Date().toISOString();
    return {
        id: uuid(),
        itemType,
        data,
        metadata,
        createdAt: now,
        updatedAt: now,
        authorDeviceId: deviceId,
        deletedAt: null,
    };
}

export function updateVaultItemTimestamp(item: VaultItem): VaultItem {
    return { ...item, updatedAt: new Date().toISOString() };
}
