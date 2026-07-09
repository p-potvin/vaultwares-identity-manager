import type { AddressItem } from './vault';

export interface Identity {
    id: string;
    fullName: string;
    gender: 'male' | 'female' | 'non-binary' | 'other';
    birthDate: string;
    nationality: string;
    bio: string;
    email: string;
    phone: string;
    address: AddressItem;
    facePhoto: string | null;
    metadata: {
        tags: string[];
        favorite: boolean;
    };
    createdAt: string;
    updatedAt: string;
    authorDeviceId: string;
    deletedAt: string | null;
    lastUsedAt: string | null;
}

export interface GeneratedIdentityData {
    fullName: string;
    gender: 'male' | 'female' | 'non-binary' | 'other';
    birthDate: string;
    nationality: string;
    bio: string;
    email: string;
    phone: string;
    address: {
        fullName: string;
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
        phone: string;
    };
}

export interface EncryptedIdentity {
    id: string;
    envelope: import('./crypto').VaultEnvelope;
    deletedAt: string | null;
}
