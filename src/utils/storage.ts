import type { EncryptedVaultItem, VaultSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { localStore } from '../platform/store';

const VAULT_ITEMS_KEY = 'vw_vault_items';
const SETTINGS_KEY = 'vw_settings';
const SYNC_CURSOR_KEY = 'vw_sync_cursor';

/** The loopback default shipped before vault-warden moved to greencloud. */
const RETIRED_SYNC_URLS = ['http://127.0.0.1:9444/v1', 'http://localhost:9444/v1'];

/**
 * The vault blob is one storage key holding every envelope — tens of MB at a
 * few thousand items — and every read deserializes all of it. The background
 * reads it several times per navigation (badge, matches, save prompts), so the
 * deserialized array is kept and swapped in only after a write succeeds: a
 * failed write must not leave the cache describing storage that never happened.
 * Cleartext-at-rest data, same as storage.local already holds; a suspended
 * event page simply re-reads on wake.
 */
let itemsCache: EncryptedVaultItem[] | null = null;

export async function getEncryptedItems(): Promise<EncryptedVaultItem[]> {
    if (itemsCache) return itemsCache;
    const result = await localStore.get(VAULT_ITEMS_KEY);
    itemsCache = (result[VAULT_ITEMS_KEY] as EncryptedVaultItem[]) ?? [];
    return itemsCache;
}

export async function saveEncryptedItem(item: EncryptedVaultItem): Promise<void> {
    const items = await getEncryptedItems();
    const idx = items.findIndex(i => i.id === item.id);
    const next = items.slice();
    if (idx >= 0) {
        next[idx] = item;
    } else {
        next.push(item);
    }
    await localStore.set({ [VAULT_ITEMS_KEY]: next });
    itemsCache = next;
}

export async function deleteEncryptedItem(id: string): Promise<void> {
    const items = await getEncryptedItems();
    const filtered = items.filter(i => i.id !== id);
    await localStore.set({ [VAULT_ITEMS_KEY]: filtered });
    itemsCache = filtered;
}

export async function getSettings(): Promise<VaultSettings> {
    const result = await localStore.get(SETTINGS_KEY);
    const stored = result[SETTINGS_KEY] as Partial<VaultSettings> | undefined;
    // Merged rather than returned as-is: a settings blob written by an older
    // version has no key for a newly added setting, and a missing boolean would
    // read as `false` and silently disable the feature it gates.
    const settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };

    // A stored value beats the default, which is right for a setting the user
    // chose and wrong for one they never touched. Nothing listens on
    // 127.0.0.1:9444 on a workstation, so an install carrying the old default
    // would silently fail to sync and read as "vault-warden is down".
    if (RETIRED_SYNC_URLS.includes(settings.syncServerUrl)) {
        settings.syncServerUrl = DEFAULT_SETTINGS.syncServerUrl;
    }
    return settings;
}

export async function saveSettings(settings: VaultSettings): Promise<void> {
    await localStore.set({ [SETTINGS_KEY]: settings });
}

export async function getSyncCursor(): Promise<string | null> {
    const result = await localStore.get(SYNC_CURSOR_KEY);
    return (result[SYNC_CURSOR_KEY] as string) ?? null;
}

export async function setSyncCursor(cursor: string): Promise<void> {
    await localStore.set({ [SYNC_CURSOR_KEY]: cursor });
}

export async function replaceAllEncryptedItems(items: EncryptedVaultItem[]): Promise<void> {
    await localStore.set({ [VAULT_ITEMS_KEY]: items });
    itemsCache = items;
}
