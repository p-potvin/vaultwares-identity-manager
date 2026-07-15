export type DeviceRole = 'master' | 'trusted' | 'pending';
export type ApprovalState = 'pending' | 'approved' | 'revoked';

export interface PQCKeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
}

export interface PQCKeyPairBase64 {
    publicKey: string;
    secretKey: string;
}

export interface DeviceKeyBundle {
    kemKeyPair: PQCKeyPairBase64;
    sigKeyPair: PQCKeyPairBase64;
    deviceId: string;
    deviceName: string;
    deviceClass: string;
    platform: string;
}

export interface DeviceInfo {
    id: string;
    deviceName: string;
    deviceClass: string;
    platform: string;
    deviceRole: DeviceRole;
    approvalState: ApprovalState;
    approvedBy: string | null;
    lastSeenAt: string | null;
    createdAt: string;
}

export interface VaultEnvelope {
    version: number;
    itemType: string;
    ciphertext: string;
    nonce: string;
    encapsulatedKey: string;
    metadata: {
        label: string;
        domain?: string;
        iconRef?: string;
        tags: string[];
        favorite: boolean;
        identityId?: string | null;
    };
    signature: string;
    createdAt: string;
    updatedAt: string;
    authorDeviceId: string;
    lastUsedAt?: string | null;
}

export interface EncryptedVaultItem {
    id: string;
    envelope: VaultEnvelope;
    deletedAt: string | null;
}

export interface SyncPushRequest {
    items: EncryptedVaultItem[];
    cursor: string | null;
}

export interface SyncPushResponse {
    cursor: string;
    conflicts: EncryptedVaultItem[];
}

export interface SyncPullResponse {
    items: EncryptedVaultItem[];
    cursor: string;
    hasMore: boolean;
}

/** An AES-GCM blob, base64-encoded. */
export interface EncBlob {
    ciphertext: string;
    nonce: string;
}

/**
 * Restores a vault onto a new device/profile: the PIN unwraps the master key,
 * which in turn decrypts the account KEM/signing secret keys — the keys that
 * actually open synced envelopes.
 */
export interface RecoveryKit {
    version: number;
    kemPublicKey: string;
    sigPublicKey: string;
    /** Account secret keys, encrypted under the master key. */
    kemSecretKeyEnc: EncBlob;
    sigSecretKeyEnc: EncBlob;
    /** Master key, encrypted under the PIN-derived key (via `salt`). */
    wrappedMasterKey: EncBlob;
    salt: string;
    createdAt: string;
}

/**
 * Public keys are stored in the clear; secret keys are encrypted under the
 * master key, which is itself only recoverable from the PIN. Nothing here
 * discloses vault contents to someone who can read chrome.storage.local.
 */
export interface KeychainState {
    kemPublicKey: string | null;
    sigPublicKey: string | null;
    kemSecretKeyEnc: EncBlob | null;
    sigSecretKeyEnc: EncBlob | null;
    deviceId: string | null;
}

export interface SessionState {
    unlocked: boolean;
    deviceId: string | null;
    lastUnlockAt: number | null;
}
