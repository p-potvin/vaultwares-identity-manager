export interface Address {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
}

export interface Identity {
    id: string;
    label: string;
    firstName: string;
    lastName: string;
    email: string;
    username: string;
    phone: string;
    birthDate: string;
    address: Address;
    createdAt: number;
    updatedAt: number;
}

export interface Credential {
    id: string;
    siteUrl: string;
    siteName: string;
    username: string;
    email: string;
    password: string;
    identityId?: string;
    notes: string;
    createdAt: number;
    updatedAt: number;
}

/** Visual skin applied to the extension UI. */
export type VaultSkin = 'slate' | 'cinder' | 'mist';

export interface VaultSettings {
    skin: VaultSkin;
    autoDetect: boolean;
    autoFill: boolean;
    defaultIdentityId?: string;
    passwordLength: number;
    passwordComplexity: 'medium' | 'high' | 'maximum';
}

export interface VaultData {
    identities: Identity[];
    credentials: Credential[];
    settings: VaultSettings;
}

export type MessageType =
    | 'GET_VAULT'
    | 'SAVE_IDENTITY'
    | 'SAVE_CREDENTIAL'
    | 'DELETE_IDENTITY'
    | 'DELETE_CREDENTIAL'
    | 'GENERATE_IDENTITY'
    | 'GENERATE_PASSWORD'
    | 'FORM_DETECTED'
    | 'FILL_FORM'
    | 'GET_SETTINGS'
    | 'UPDATE_SETTINGS';

export interface Message {
    type: MessageType;
    payload?: unknown;
}

export interface MessageResponse {
    success: boolean;
    data?: unknown;
    error?: string;
}

export interface FormDetectionResult {
    detected: boolean;
    score: number;
    fields: DetectedField[];
}

export interface DetectedField {
    element: HTMLInputElement | HTMLSelectElement;
    role: FieldRole;
}

export type FieldRole =
    | 'firstName'
    | 'lastName'
    | 'fullName'
    | 'email'
    | 'emailConfirm'
    | 'username'
    | 'password'
    | 'passwordConfirm'
    | 'phone'
    | 'birthDate'
    | 'street'
    | 'city'
    | 'state'
    | 'country'
    | 'zipCode'
    | 'unknown';

export interface GeneratePasswordOptions {
    length: number;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
}

/** Normalised metadata about a domain used to drive login/sign-up suggestions. */
export interface DomainProfile {
    domainProfileId: string;
    normalizedDomain: string;
    displayDomain: string;
    siteName: string;
    lastSeenAt: number;
}

export type DomainLinkType = 'preferred-login' | 'prior-signup' | 'suggested-identity';

/** Links a vault item (identity or credential) to a specific domain. */
export interface DomainIdentityLink {
    domainIdentityLinkId: string;
    normalizedDomain: string;
    vaultItemId: string;
    linkType: DomainLinkType;
    confidenceScore: number;
    lastUsedAt: number;
}
