import type { VaultData, Identity, Credential, VaultSettings } from '../types';

const DEFAULT_SETTINGS: VaultSettings = {
    theme: 'dark',
    autoDetect: true,
    autoFill: false,
    passwordLength: 16,
    passwordComplexity: 'maximum',
};

const DEFAULT_VAULT: VaultData = {
    identities: [],
    credentials: [],
    settings: DEFAULT_SETTINGS,
};

export const getVault = async (): Promise<VaultData> => {
    const result = await chrome.storage.local.get('vault');
    return (result['vault'] as VaultData) ?? structuredClone(DEFAULT_VAULT);
};

export const saveVault = async (vault: VaultData): Promise<void> => {
    await chrome.storage.local.set({ vault });
};

export const getSettings = async (): Promise<VaultSettings> => {
    const vault = await getVault();
    return vault.settings;
};

export const updateSettings = async (settings: Partial<VaultSettings>): Promise<void> => {
    const vault = await getVault();
    vault.settings = { ...vault.settings, ...settings };
    await saveVault(vault);
};

export const saveIdentity = async (identity: Identity): Promise<void> => {
    const vault = await getVault();
    const idx = vault.identities.findIndex(i => i.id === identity.id);

    if (idx >= 0) {
        vault.identities[idx] = identity;
    } else {
        vault.identities.push(identity);
    }

    await saveVault(vault);
};

export const deleteIdentity = async (id: string): Promise<void> => {
    const vault = await getVault();
    vault.identities = vault.identities.filter(i => i.id !== id);
    await saveVault(vault);
};

export const saveCredential = async (credential: Credential): Promise<void> => {
    const vault = await getVault();
    const idx = vault.credentials.findIndex(c => c.id === credential.id);

    if (idx >= 0) {
        vault.credentials[idx] = credential;
    } else {
        vault.credentials.push(credential);
    }

    await saveVault(vault);
};

export const deleteCredential = async (id: string): Promise<void> => {
    const vault = await getVault();
    vault.credentials = vault.credentials.filter(c => c.id !== id);
    await saveVault(vault);
};
