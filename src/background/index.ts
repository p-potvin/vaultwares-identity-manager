import { initKeychain, wrapAndStoreMasterKey, unwrapMasterKey, setCachedMasterKey, getCachedMasterKey, setDeviceId, getKeychain, isInitialized, getKemPublicKey, getSigKeyPair, getKemSecretKey, clearKeychain } from '../crypto/keychain';
import { createEnvelope, openEnvelope, createVaultItem, updateVaultItemTimestamp } from '../crypto/envelope';
import { generateRecoveryKit, downloadRecoveryKit } from '../crypto/recovery';
import { generateKemKeyPair, generateSigKeyPair, kemKeyPairToBase64, sigKeyPairToBase64, toBase64, sign } from '../crypto/pqc';
import { getEncryptedItems, saveEncryptedItem, deleteEncryptedItem, replaceAllEncryptedItems, getSettings, saveSettings, getSyncCursor, setSyncCursor } from '../utils/storage';
import { register as apiRegister } from '../api/auth';
import { createVaultItem as apiCreateItem, updateVaultItem as apiUpdateItem, deleteVaultItem as apiDeleteItem } from '../api/vault';
import { pushChanges, pullChanges } from '../api/sync';
import type { VaultItem, EncryptedVaultItem, ItemType, VaultItemData, VaultItemMetadata, VaultSettings, RecoveryKit } from '../types';

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
    | 'GET_PAGE_MATCHES';

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
        const { kemKeyPair, sigKeyPair, masterKey } = await initKeychain();
        await wrapAndStoreMasterKey(masterKey, payload.pin);

        const kemKp = generateKemKeyPair();
        const sigKp = generateSigKeyPair();
        const kemB64 = kemKeyPairToBase64(kemKp);
        const sigB64 = sigKeyPairToBase64(sigKp);

        const resp = await apiRegister({
            email: payload.email,
            kemPublicKey: kemB64.publicKey,
            sigPublicKey: sigB64.publicKey,
            deviceName: navigator.userAgent.includes('Firefox') ? 'Firefox Browser' : 'Chrome Browser',
            deviceClass: 'browser',
            platform: navigator.platform,
        });

        await setDeviceId(resp.deviceId);
        setCachedMasterKey(masterKey);
        resetLockTimer();

        return { success: true, data: { deviceId: resp.deviceId, deviceRole: resp.deviceRole } };
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
        setCachedMasterKey(masterKey);
        resetLockTimer();
        return { success: true };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

function handleLock(): MessageResponse {
    setCachedMasterKey(null);
    if (lockTimer) clearTimeout(lockTimer);
    return { success: true };
}

async function handleGetUnlocked(): Promise<MessageResponse> {
    return { success: true, data: { unlocked: getCachedMasterKey() !== null } };
}

async function handleGetItems(): Promise<MessageResponse> {
    try {
        const encryptedItems = await getEncryptedItems();
        const kemSecretKey = await getKemSecretKey();
        const sigKp = await getSigKeyPair();

        if (!kemSecretKey || !sigKp) {
            return { success: false, error: 'Keychain not initialized' };
        }

        const masterKey = getCachedMasterKey();
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

        try {
            await apiCreateItem(encrypted.envelope);
        } catch (e) {
            console.warn('API sync failed, item saved locally:', e);
        }

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

        try {
            await apiUpdateItem(updated.id, encrypted.envelope);
        } catch (e) {
            console.warn('API sync failed, item updated locally:', e);
        }

        return { success: true, data: updated };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

async function handleDeleteItem(payload: { id: string }): Promise<MessageResponse> {
    try {
        await deleteEncryptedItem(payload.id);

        try {
            await apiDeleteItem(payload.id);
        } catch (e) {
            console.warn('API sync failed, item deleted locally:', e);
        }

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
        const masterKey = getCachedMasterKey();
        if (!masterKey) return { success: false, error: 'Vault is locked' };

        const kit = generateRecoveryKit(masterKey, payload.pin);
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
        const localItems = await getEncryptedItems();
        const cursor = await getSyncCursor();

        const pushResp = await pushChanges(localItems, cursor);
        await setSyncCursor(pushResp.cursor);

        const pullResp = await pullChanges(pushResp.cursor);
        await setSyncCursor(pullResp.cursor);

        const merged = [...localItems];
        for (const remoteItem of pullResp.items) {
            const idx = merged.findIndex(i => i.id === remoteItem.id);
            if (idx >= 0) {
                const local = merged[idx];
                const remoteUpdated = new Date(remoteItem.envelope.updatedAt).getTime();
                const localUpdated = new Date(local.envelope.updatedAt).getTime();
                if (remoteUpdated > localUpdated) {
                    merged[idx] = remoteItem;
                }
            } else {
                merged.push(remoteItem);
            }
        }

        await replaceAllEncryptedItems(merged);
        return { success: true, data: { synced: pullResp.items.length } };
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

        const masterKey = getCachedMasterKey();
        if (!masterKey) return { success: true, data: [] };

        const { normalizeDomain } = await import('../utils/domain');
        const normalizedDomain = normalizeDomain(payload.url);

        const matches: VaultItem[] = [];
        for (const enc of items) {
            if (enc.deletedAt) continue;
            if (enc.envelope.metadata.domain === normalizedDomain) {
                try {
                    const item = openEnvelope(enc, kemSecretKey, sigKp.publicKey);
                    matches.push(item);
                } catch (e) {
                    console.error('Failed to decrypt item:', enc.id, e);
                }
            }
        }

        return { success: true, data: matches };
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
                response = handleLock();
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
            default:
                response = { success: false, error: 'Unknown message type' };
        }

        sendResponse(response);
    })();

    return true;
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('VaultWares Identity Manager installed');
});
