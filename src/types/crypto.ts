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
    };
    signature: string;
    createdAt: string;
    updatedAt: string;
    authorDeviceId: string;
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

export interface RecoveryKit {
    version: number;
    kemPublicKey: string;
    kemSecretKey: string;
    wrappedMasterKey: string;
    salt: string;
    createdAt: string;
}

export interface KeychainState {
    kemKeyPair: PQCKeyPairBase64 | null;
    sigKeyPair: PQCKeyPairBase64 | null;
    masterKey: Uint8Array | null;
    deviceId: string | null;
}

export interface SessionState {
    unlocked: boolean;
    deviceId: string | null;
    lastUnlockAt: number | null;
}
