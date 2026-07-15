import { initKeychain, wrapAndStoreMasterKey, unwrapMasterKey, setCachedMasterKey, getCachedMasterKey, setDeviceId, getKeychain, isInitialized, getKemPublicKey, getSigKeyPair, getKemSecretKey, clearKeychain } from '../crypto/keychain';
import { createEnvelope, openEnvelope, createVaultItem, updateVaultItemTimestamp } from '../crypto/envelope';
import { generateRecoveryKit, downloadRecoveryKit } from '../crypto/recovery';
import { getEncryptedItems, saveEncryptedItem, deleteEncryptedItem, replaceAllEncryptedItems, getSettings, saveSettings, getSyncCursor, setSyncCursor } from '../utils/storage';
import { getEncryptedIdentities, saveEncryptedIdentity, deleteEncryptedIdentity, encryptIdentity, decryptIdentity } from '../utils/identity-storage';
import { register as apiRegister } from '../api/auth';
import { createVaultItem as apiCreateItem, updateVaultItem as apiUpdateItem, deleteVaultItem as apiDeleteItem } from '../api/vault';
import { pushChanges, pullChanges } from '../api/sync';
import { enqueueCreate, enqueueUpdate, enqueueDelete, processQueue, fullSync, startAutoSync } from '../api/sync-queue';
import { generateIdentity as generateIdentityApi } from '../api/generation';
import type { VaultItem, EncryptedVaultItem, ItemType, VaultItemData, VaultItemMetadata, VaultSettings, RecoveryKit, Identity, GeneratedIdentityData } from '../types';

export type MessageType =
    | 'INIT_CHECK'
    | 'SETUP_ACCOUNT'
    | 'UNLOCK'
    | 'LOCK'
    | 'GET_UNLOCKED'
    | 'GET_ITEMS'
    | 'CREATE_ITEM'
    | 'UPDATE_ITEM'
    | 'DELETE_ITEM'
    | 'GET_SETTINGS'
    | 'SAVE_SETTINGS'
    | 'GENERATE_RECOVERY_KIT'
    | 'DOWNLOAD_RECOVERY_KIT'
    | 'SYNC'
    | 'GET_PAGE_MATCHES'
    | 'OPEN_POPUP_CREATE'
    | 'GET_IDENTITIES'
    | 'CREATE_IDENTITY'
    | 'UPDATE_IDENTITY'
    | 'DELETE_IDENTITY'
    | 'GENERATE_IDENTITY'
    | 'ASSIGN_ITEM_TO_IDENTITY'
    | 'UNASSIGN_ITEM_FROM_IDENTITY'
    | 'UPDATE_ITEM_LAST_USED';

export interface Message {
    type: MessageType;
    payload?: any;
}

export interface MessageResponse {
    success: boolean;
    data?: any;
    error?: string;
}

let lockTimer: ReturnType<typeof setTimeout> | null = null;

function resetLockTimer(): void {
    if (lockTimer) clearTimeout(lockTimer);
    getSettings().then(settings => {
        if (settings.autoLockMinutes > 0) {
            lockTimer = setTimeout(() => {
                setCachedMasterKey(null);
            }, settings.autoLockMinutes * 60 * 1000);
        }
    });
}

async function handleSetupAccount(payload: { email: string; pin: string }): Promise<MessageResponse> {
    try {
        const { kemPublicKey, sigPublicKey, masterKey } = await initKeychain();
        await wrapAndStoreMasterKey(masterKey, payload.pin);

        // Vault sync is local (see api/sync.ts), so account registration with the
        // cloud is optional. Try it for the AI-generation account, but fall back
        // to a locally-generated device id so the extension works fully offline.
        let deviceId: string;
        let deviceRole = 'master';
        try {
            const resp = await apiRegister({
                email: payload.email,
                kemPublicKey,
                sigPublicKey,
                deviceName: navigator.userAgent.includes('Firefox') ? 'Firefox Browser' : 'Chrome Browser',
                deviceClass: 'browser',
                platform: navigator.platform,
            });
            deviceId = resp.deviceId;
            deviceRole = resp.deviceRole;
        } catch (e) {
            console.warn('Cloud registration unavailable, continuing local-only:', (e as Error).message);
            deviceId = crypto.randomUUID();
        }

        await setDeviceId(deviceId);
        await setCachedMasterKey(masterKey);
        resetLockTimer();

        return { success: true, data: { deviceId, deviceRole } };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleUnlock(payload: { pin: string }): Promise<MessageResponse> {
    try {
        const masterKey = await unwrapMasterKey(payload.pin);
        if (!masterKey) {
            return { success: false, error: 'Invalid PIN' };
        }
        await setCachedMasterKey(masterKey);
        resetLockTimer();
        return { success: true };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleLock(): Promise<MessageResponse> {
    await setCachedMasterKey(null);
    if (lockTimer) clearTimeout(lockTimer);
    return { success: true };
}

async function handleGetUnlocked(): Promise<MessageResponse> {
    const key = await getCachedMasterKey();
    return { success: true, data: { unlocked: key !== null } };
}

async function handleGetItems(): Promise<MessageResponse> {
    try {
        const encryptedItems = await getEncryptedItems();
        const kemSecretKey = await getKemSecretKey();
        const sigKp = await getSigKeyPair();

        if (!kemSecretKey || !sigKp) {
            return { success: false, error: 'Keychain not initialized' };
        }

        const masterKey = await getCachedMasterKey();
        if (!masterKey) {
            return { success: false, error: 'Vault is locked' };
        }

        const items: VaultItem[] = [];
        for (const enc of encryptedItems) {
            if (enc.deletedAt) continue;
            try {
                const item = openEnvelope(enc, kemSecretKey, sigKp.publicKey);
                items.push(item);
            } catch (e) {
                console.error('Failed to decrypt item:', enc.id, e);
            }
        }

        return { success: true, data: items };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleCreateItem(payload: { itemType: ItemType; data: VaultItemData; metadata: VaultItemMetadata }): Promise<MessageResponse> {
    try {
        const keychain = await getKeychain();
        if (!keychain?.deviceId) return { success: false, error: 'No device ID' };

        const kemPubKey = await getKemPublicKey();
        const sigKp = await getSigKeyPair();
        if (!kemPubKey || !sigKp) return { success: false, error: 'Keychain not initialized' };

        const item = createVaultItem(payload.itemType, payload.data, payload.metadata, keychain.deviceId);
        const encrypted = createEnvelope(item, kemPubKey, sigKp.secretKey, keychain.deviceId);

        await saveEncryptedItem(encrypted);
        await enqueueCreate(encrypted);

        return { success: true, data: item };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleUpdateItem(payload: { id: string; data: VaultItemData; metadata: VaultItemMetadata }): Promise<MessageResponse> {
    try {
        const keychain = await getKeychain();
        if (!keychain?.deviceId) return { success: false, error: 'No device ID' };

        const kemPubKey = await getKemPublicKey();
        const sigKp = await getSigKeyPair();
        if (!kemPubKey || !sigKp) return { success: false, error: 'Keychain not initialized' };

        const encryptedItems = await getEncryptedItems();
        const existing = encryptedItems.find(i => i.id === payload.id);
        if (!existing) return { success: false, error: 'Item not found' };

        const kemSecretKey = await getKemSecretKey();
        if (!kemSecretKey) return { success: false, error: 'Keychain not initialized' };

        const item = openEnvelope(existing, kemSecretKey, sigKp.publicKey);
        const updated: VaultItem = {
            ...item,
            data: payload.data,
            metadata: payload.metadata,
            updatedAt: new Date().toISOString(),
        };

        const encrypted = createEnvelope(updated, kemPubKey, sigKp.secretKey, keychain.deviceId);
        await saveEncryptedItem(encrypted);
        await enqueueUpdate(encrypted);

        return { success: true, data: updated };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleDeleteItem(payload: { id: string }): Promise<MessageResponse> {
    try {
        await deleteEncryptedItem(payload.id);
        await enqueueDelete(payload.id);

        return { success: true };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleGetSettings(): Promise<MessageResponse> {
    const settings = await getSettings();
    return { success: true, data: settings };
}

async function handleSaveSettings(payload: VaultSettings): Promise<MessageResponse> {
    await saveSettings(payload);
    return { success: true };
}

async function handleGenerateRecoveryKit(payload: { pin: string }): Promise<MessageResponse> {
    try {
        const masterKey = await getCachedMasterKey();
        if (!masterKey) return { success: false, error: 'Vault is locked' };

        const kit = await generateRecoveryKit(masterKey, payload.pin);
        return { success: true, data: kit };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleDownloadRecoveryKit(payload: { kit: RecoveryKit }): Promise<MessageResponse> {
    try {
        downloadRecoveryKit(payload.kit);
        return { success: true };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleSync(): Promise<MessageResponse> {
    try {
        const queueResult = await processQueue();
        const syncResult = await fullSync();
        return { success: true, data: { ...syncResult, ...queueResult } };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleGetPageMatches(payload: { url: string }): Promise<MessageResponse> {
    try {
        const items = await getEncryptedItems();
        const kemSecretKey = await getKemSecretKey();
        const sigKp = await getSigKeyPair();

        if (!kemSecretKey || !sigKp) return { success: true, data: [] };

        const masterKey = await getCachedMasterKey();
        if (!masterKey) return { success: true, data: [] };

        const { normalizeDomain, domainMatches, urlMatches } = await import('../utils/domain');
        const pageDomain = normalizeDomain(payload.url);

        const exactMatches: VaultItem[] = [];
        const fuzzyMatches: VaultItem[] = [];

        for (const enc of items) {
            if (enc.deletedAt) continue;
            const itemDomain = enc.envelope.metadata.domain || '';
            const isExact = itemDomain === pageDomain;
            const isFuzzy = !isExact && domainMatches(itemDomain, payload.url);

            if (isExact || isFuzzy) {
                try {
                    const item = openEnvelope(enc, kemSecretKey, sigKp.publicKey);
                    if (isExact) exactMatches.push(item);
                    else fuzzyMatches.push(item);
                } catch (e) {
                    console.error('Failed to decrypt item:', enc.id, e);
                }
                continue;
            }

            if (enc.envelope.itemType === 'login') {
                try {
                    const item = openEnvelope(enc, kemSecretKey, sigKp.publicKey);
                    const loginData = item.data as import('../types').LoginItem;
                    if (loginData.url && urlMatches(loginData.url, payload.url)) {
                        fuzzyMatches.push(item);
                    }
                } catch (e) {
                    console.error('Failed to decrypt item:', enc.id, e);
                }
            }
        }

        const allMatches = [...exactMatches, ...fuzzyMatches];
        return { success: true, data: allMatches };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

function createIdentityObject(data: GeneratedIdentityData, deviceId: string): Identity {
    const now = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        fullName: data.fullName,
        gender: data.gender,
        birthDate: data.birthDate,
        nationality: data.nationality,
        bio: data.bio,
        email: data.email,
        phone: data.phone,
        address: data.address,
        facePhoto: null,
        metadata: { tags: [], favorite: false },
        createdAt: now,
        updatedAt: now,
        authorDeviceId: deviceId,
        deletedAt: null,
        lastUsedAt: null,
    };
}

async function handleGetIdentities(): Promise<MessageResponse> {
    try {
        const encIdentities = await getEncryptedIdentities();
        const kemSecretKey = await getKemSecretKey();
        const sigKp = await getSigKeyPair();
        if (!kemSecretKey || !sigKp) return { success: true, data: [] };

        const masterKey = await getCachedMasterKey();
        if (!masterKey) return { success: true, data: [] };

        const identities: Identity[] = [];
        for (const enc of encIdentities) {
            if (enc.deletedAt) continue;
            try {
                identities.push(decryptIdentity(enc, kemSecretKey, sigKp.publicKey));
            } catch (e) {
                console.error('Failed to decrypt identity:', enc.id, e);
            }
        }
        return { success: true, data: identities };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleCreateIdentity(payload: { data: GeneratedIdentityData }): Promise<MessageResponse> {
    try {
        const keychain = await getKeychain();
        if (!keychain?.deviceId) return { success: false, error: 'No device ID' };

        const kemPubKey = await getKemPublicKey();
        const sigKp = await getSigKeyPair();
        if (!kemPubKey || !sigKp) return { success: false, error: 'Keychain not initialized' };

        const identity = createIdentityObject(payload.data, keychain.deviceId);
        const encrypted = encryptIdentity(identity, kemPubKey, sigKp.secretKey, keychain.deviceId);
        await saveEncryptedIdentity(encrypted);

        return { success: true, data: identity };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleUpdateIdentity(payload: { identity: Identity }): Promise<MessageResponse> {
    try {
        const keychain = await getKeychain();
        if (!keychain?.deviceId) return { success: false, error: 'No device ID' };

        const kemPubKey = await getKemPublicKey();
        const sigKp = await getSigKeyPair();
        if (!kemPubKey || !sigKp) return { success: false, error: 'Keychain not initialized' };

        const updated: Identity = { ...payload.identity, updatedAt: new Date().toISOString() };
        const encrypted = encryptIdentity(updated, kemPubKey, sigKp.secretKey, keychain.deviceId);
        await saveEncryptedIdentity(encrypted);

        return { success: true, data: updated };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleDeleteIdentity(payload: { id: string }): Promise<MessageResponse> {
    try {
        await deleteEncryptedIdentity(payload.id);
        return { success: true };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleGenerateIdentity(payload?: { options?: any }): Promise<MessageResponse> {
    try {
        const settings = await getSettings();
        const data = await generateIdentityApi(settings.generationEndpointUrl || undefined, payload?.options);
        return { success: true, data };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleAssignItemToIdentity(payload: { itemId: string; identityId: string }): Promise<MessageResponse> {
    try {
        const keychain = await getKeychain();
        if (!keychain?.deviceId) return { success: false, error: 'No device ID' };

        const kemPubKey = await getKemPublicKey();
        const sigKp = await getSigKeyPair();
        if (!kemPubKey || !sigKp) return { success: false, error: 'Keychain not initialized' };

        const items = await getEncryptedItems();
        const enc = items.find(i => i.id === payload.itemId);
        if (!enc) return { success: false, error: 'Item not found' };

        const kemSecretKey = await getKemSecretKey();
        if (!kemSecretKey) return { success: false, error: 'Keychain not initialized' };

        const item = openEnvelope(enc, kemSecretKey, sigKp.publicKey);
        const updated: VaultItem = { ...item, identityId: payload.identityId, updatedAt: new Date().toISOString() };
        const reencrypted = createEnvelope(updated, kemPubKey, sigKp.secretKey, keychain.deviceId);
        await saveEncryptedItem(reencrypted);

        return { success: true, data: updated };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleUnassignItemFromIdentity(payload: { itemId: string }): Promise<MessageResponse> {
    try {
        const keychain = await getKeychain();
        if (!keychain?.deviceId) return { success: false, error: 'No device ID' };

        const kemPubKey = await getKemPublicKey();
        const sigKp = await getSigKeyPair();
        if (!kemPubKey || !sigKp) return { success: false, error: 'Keychain not initialized' };

        const items = await getEncryptedItems();
        const enc = items.find(i => i.id === payload.itemId);
        if (!enc) return { success: false, error: 'Item not found' };

        const kemSecretKey = await getKemSecretKey();
        if (!kemSecretKey) return { success: false, error: 'Keychain not initialized' };

        const item = openEnvelope(enc, kemSecretKey, sigKp.publicKey);
        const updated: VaultItem = { ...item, identityId: null, updatedAt: new Date().toISOString() };
        const reencrypted = createEnvelope(updated, kemPubKey, sigKp.secretKey, keychain.deviceId);
        await saveEncryptedItem(reencrypted);

        return { success: true, data: updated };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleUpdateItemLastUsed(payload: { itemId: string }): Promise<MessageResponse> {
    try {
        const keychain = await getKeychain();
        if (!keychain?.deviceId) return { success: false, error: 'No device ID' };

        const kemPubKey = await getKemPublicKey();
        const sigKp = await getSigKeyPair();
        if (!kemPubKey || !sigKp) return { success: false, error: 'Keychain not initialized' };

        const items = await getEncryptedItems();
        const enc = items.find(i => i.id === payload.itemId);
        if (!enc) return { success: false, error: 'Item not found' };

        const kemSecretKey = await getKemSecretKey();
        if (!kemSecretKey) return { success: false, error: 'Keychain not initialized' };

        const item = openEnvelope(enc, kemSecretKey, sigKp.publicKey);
        const updated: VaultItem = { ...item, lastUsedAt: new Date().toISOString() };
        const reencrypted = createEnvelope(updated, kemPubKey, sigKp.secretKey, keychain.deviceId);
        await saveEncryptedItem(reencrypted);

        return { success: true };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    (async () => {
        let response: MessageResponse;

        switch (message.type) {
            case 'INIT_CHECK':
                response = { success: true, data: { initialized: await isInitialized() } };
                break;
            case 'SETUP_ACCOUNT':
                response = await handleSetupAccount(message.payload);
                break;
            case 'UNLOCK':
                response = await handleUnlock(message.payload);
                break;
            case 'LOCK':
                response = await handleLock();
                break;
            case 'GET_UNLOCKED':
                response = await handleGetUnlocked();
                break;
            case 'GET_ITEMS':
                response = await handleGetItems();
                break;
            case 'CREATE_ITEM':
                response = await handleCreateItem(message.payload);
                break;
            case 'UPDATE_ITEM':
                response = await handleUpdateItem(message.payload);
                break;
            case 'DELETE_ITEM':
                response = await handleDeleteItem(message.payload);
                break;
            case 'GET_SETTINGS':
                response = await handleGetSettings();
                break;
            case 'SAVE_SETTINGS':
                response = await handleSaveSettings(message.payload);
                break;
            case 'GENERATE_RECOVERY_KIT':
                response = await handleGenerateRecoveryKit(message.payload);
                break;
            case 'DOWNLOAD_RECOVERY_KIT':
                response = await handleDownloadRecoveryKit(message.payload);
                break;
            case 'SYNC':
                response = await handleSync();
                break;
            case 'GET_PAGE_MATCHES':
                response = await handleGetPageMatches(message.payload);
                break;
            case 'OPEN_POPUP_CREATE':
                chrome.tabs.create({ url: chrome.runtime.getURL('vault.html?action=create&url=' + encodeURIComponent(message.payload?.url || '')) });
                response = { success: true };
                break;
            case 'GET_IDENTITIES':
                response = await handleGetIdentities();
                break;
            case 'CREATE_IDENTITY':
                response = await handleCreateIdentity(message.payload);
                break;
            case 'UPDATE_IDENTITY':
                response = await handleUpdateIdentity(message.payload);
                break;
            case 'DELETE_IDENTITY':
                response = await handleDeleteIdentity(message.payload);
                break;
            case 'GENERATE_IDENTITY':
                response = await handleGenerateIdentity(message.payload);
                break;
            case 'ASSIGN_ITEM_TO_IDENTITY':
                response = await handleAssignItemToIdentity(message.payload);
                break;
            case 'UNASSIGN_ITEM_FROM_IDENTITY':
                response = await handleUnassignItemFromIdentity(message.payload);
                break;
            case 'UPDATE_ITEM_LAST_USED':
                response = await handleUpdateItemLastUsed(message.payload);
                break;
            default:
                response = { success: false, error: 'Unknown message type' };
        }

        sendResponse(response);
    })();

    return true;
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('VaultWares Identity Manager installed');
    startAutoSync();
});

startAutoSync();
