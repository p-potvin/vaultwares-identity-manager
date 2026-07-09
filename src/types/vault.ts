export type ItemType = 'login' | 'address' | 'card' | 'totp' | 'passkey';

export interface LoginItem {
    url: string;
    username: string;
    password: string;
    notes?: string;
    totpSecret?: string;
}

export interface AddressItem {
    fullName: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phone?: string;
}

export interface CardItem {
    holderName: string;
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
    notes?: string;
}

export interface TotpItem {
    label: string;
    secret: string;
    issuer?: string;
    digits: number;
    period: number;
    algorithm: 'SHA1' | 'SHA256' | 'SHA512';
}

export interface PasskeyItem {
    rpId: string;
    credentialId: string;
    privateKey: string;
    userHandle: string;
    notes?: string;
}

export type VaultItemData = LoginItem | AddressItem | CardItem | TotpItem | PasskeyItem;

export interface VaultItemMetadata {
    label: string;
    domain?: string;
    iconRef?: string;
    tags: string[];
    favorite: boolean;
}

export interface VaultItem {
    id: string;
    itemType: ItemType;
    data: VaultItemData;
    metadata: VaultItemMetadata;
    createdAt: string;
    updatedAt: string;
    authorDeviceId: string;
    deletedAt: string | null;
}

export interface VaultSettings {
    autoLockMinutes: number;
    autoFillEnabled: boolean;
    autoDetectEnabled: boolean;
    defaultPasswordLength: number;
    defaultPasswordComplexity: 'medium' | 'high' | 'maximum';
}

export const DEFAULT_SETTINGS: VaultSettings = {
    autoLockMinutes: 5,
    autoFillEnabled: true,
    autoDetectEnabled: true,
    defaultPasswordLength: 20,
    defaultPasswordComplexity: 'maximum',
};
