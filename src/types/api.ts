export interface ApiError {
    error: string;
    code?: string;
}

export interface AuthRegisterRequest {
    email: string;
    kemPublicKey: string;
    sigPublicKey: string;
    deviceName: string;
    deviceClass: string;
    platform: string;
}

export interface AuthRegisterResponse {
    userId: string;
    deviceId: string;
    deviceRole: 'master';
    accessToken: string;
    refreshToken: string;
}

export interface AuthLoginRequest {
    email: string;
}

export interface AuthLoginResponse {
    deviceId: string;
    approvalState: string;
    accessToken?: string;
    refreshToken?: string;
}

export interface AuthRefreshRequest {
    refreshToken: string;
}

export interface AuthRefreshResponse {
    accessToken: string;
    refreshToken: string;
}

export interface VaultItemCreateRequest {
    envelope: import('./crypto').VaultEnvelope;
}

export interface VaultItemUpdateRequest {
    envelope: import('./crypto').VaultEnvelope;
}

export interface VaultItemResponse {
    id: string;
    envelope: import('./crypto').VaultEnvelope;
    deletedAt: string | null;
}

export interface VaultItemListResponse {
    items: VaultItemResponse[];
}

export interface DeviceRegisterRequest {
    kemPublicKey: string;
    sigPublicKey: string;
    deviceName: string;
    deviceClass: string;
    platform: string;
}

export interface DeviceRegisterResponse {
    deviceId: string;
    deviceRole: string;
    approvalState: string;
}

export interface DeviceApproveRequest {
    approvalSignature: string;
}

export interface DeviceListResponse {
    devices: import('./crypto').DeviceInfo[];
}

export interface SyncPushApiRequest {
    items: import('./crypto').EncryptedVaultItem[];
    cursor: string | null;
}

export interface SyncPushApiResponse {
    cursor: string;
    conflicts: import('./crypto').EncryptedVaultItem[];
}

export interface SyncPullApiResponse {
    items: import('./crypto').EncryptedVaultItem[];
    cursor: string;
    hasMore: boolean;
}
