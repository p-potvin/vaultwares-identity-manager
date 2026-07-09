import type { Identity, EncryptedVaultItem } from '../types';
import { encrypt, decrypt, generateSymmetricKey } from '../crypto/symmetric';
import { encapsulate, decapsulate, sign, verify, toBase64, fromBase64 } from '../crypto/pqc';

const IDENTITIES_KEY = 'vw_identities';

export async function getEncryptedIdentities(): Promise<EncryptedVaultItem[]> {
    const result = await chrome.storage.local.get(IDENTITIES_KEY) as Record<string, any>;
    return (result[IDENTITIES_KEY] as EncryptedVaultItem[]) ?? [];
}

export async function saveEncryptedIdentity(enc: EncryptedVaultItem): Promise<void> {
    const items = await getEncryptedIdentities();
    const idx = items.findIndex(i => i.id === enc.id);
    if (idx >= 0) {
        items[idx] = enc;
    } else {
        items.push(enc);
    }
    await chrome.storage.local.set({ [IDENTITIES_KEY]: items });
}

export async function deleteEncryptedIdentity(id: string): Promise<void> {
    const items = await getEncryptedIdentities();
    const filtered = items.filter(i => i.id !== id);
    await chrome.storage.local.set({ [IDENTITIES_KEY]: filtered });
}

export async function replaceAllEncryptedIdentities(items: EncryptedVaultItem[]): Promise<void> {
    await chrome.storage.local.set({ [IDENTITIES_KEY]: items });
}

export function encryptIdentity(
    identity: Identity,
    kemPublicKey: Uint8Array,
    sigSecretKey: Uint8Array,
    deviceId: string,
): EncryptedVaultItem {
    const plaintext = new TextEncoder().encode(JSON.stringify({
        fullName: identity.fullName,
        gender: identity.gender,
        birthDate: identity.birthDate,
        nationality: identity.nationality,
        bio: identity.bio,
        email: identity.email,
        phone: identity.phone,
        address: identity.address,
        facePhoto: identity.facePhoto,
    }));
    const itemKey = generateSymmetricKey();
    const { ciphertext, nonce } = encrypt(plaintext, itemKey);
    const { ciphertext: encapsulatedKey } = encapsulate(kemPublicKey);

    const envelope = {
        version: 1,
        itemType: 'identity',
        ciphertext: toBase64(ciphertext),
        nonce: toBase64(nonce),
        encapsulatedKey: toBase64(encapsulatedKey),
        metadata: { label: identity.fullName, ...identity.metadata },
        signature: '',
        createdAt: identity.createdAt,
        updatedAt: identity.updatedAt,
        authorDeviceId: deviceId,
        lastUsedAt: identity.lastUsedAt,
    };

    const signPayload = new TextEncoder().encode(
        envelope.ciphertext + envelope.nonce + JSON.stringify(envelope.metadata),
    );
    envelope.signature = toBase64(sign(signPayload, sigSecretKey));

    return { id: identity.id, envelope, deletedAt: identity.deletedAt };
}

export function decryptIdentity(
    enc: EncryptedVaultItem,
    kemSecretKey: Uint8Array,
    sigPublicKey: Uint8Array,
): Identity {
    const { envelope } = enc;
    const signPayload = new TextEncoder().encode(
        envelope.ciphertext + envelope.nonce + JSON.stringify(envelope.metadata),
    );
    const signature = fromBase64(envelope.signature);
    if (!verify(signPayload, signature, sigPublicKey)) {
        throw new Error('Identity envelope signature verification failed');
    }

    const encapsulatedKey = fromBase64(envelope.encapsulatedKey);
    const itemKey = decapsulate(kemSecretKey, encapsulatedKey);
    const ciphertext = fromBase64(envelope.ciphertext);
    const nonce = fromBase64(envelope.nonce);
    const plaintext = decrypt(ciphertext, nonce, itemKey);
    const data = JSON.parse(new TextDecoder().decode(plaintext));

    return {
        id: enc.id,
        fullName: data.fullName,
        gender: data.gender,
        birthDate: data.birthDate,
        nationality: data.nationality,
        bio: data.bio,
        email: data.email,
        phone: data.phone,
        address: data.address,
        facePhoto: data.facePhoto ?? null,
        metadata: envelope.metadata as any,
        createdAt: envelope.createdAt,
        updatedAt: envelope.updatedAt,
        authorDeviceId: envelope.authorDeviceId,
        deletedAt: enc.deletedAt,
        lastUsedAt: envelope.lastUsedAt ?? null,
    };
}
