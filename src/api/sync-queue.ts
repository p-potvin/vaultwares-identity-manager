import { getEncryptedItems, saveEncryptedItem, deleteEncryptedItem, getSyncCursor, setSyncCursor, replaceAllEncryptedItems } from '../utils/storage';
import { createVaultItem as apiCreateItem, updateVaultItem as apiUpdateItem, deleteVaultItem as apiDeleteItem } from '../api/vault';
import { pushChanges, pullChanges } from '../api/sync';
import type { EncryptedVaultItem } from '../types';

const QUEUE_KEY = 'vw_sync_queue';
const MAX_RETRIES = 5;
const RETRY_DELAYS = [5000, 15000, 60000, 300000, 900000];

interface QueueEntry {
    id: string;
    operation: 'create' | 'update' | 'delete';
    itemId: string;
    envelope?: any;
    attempts: number;
    createdAt: string;
}

async function getQueue(): Promise<QueueEntry[]> {
    const result = await chrome.storage.local.get(QUEUE_KEY) as Record<string, any>;
    return (result[QUEUE_KEY] as QueueEntry[]) ?? [];
}

async function saveQueue(queue: QueueEntry[]): Promise<void> {
    await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}

export async function enqueueCreate(item: EncryptedVaultItem): Promise<void> {
    const queue = await getQueue();
    queue.push({
        id: crypto.randomUUID(),
        operation: 'create',
        itemId: item.id,
        envelope: item.envelope,
        attempts: 0,
        createdAt: new Date().toISOString(),
    });
    await saveQueue(queue);
}

export async function enqueueUpdate(item: EncryptedVaultItem): Promise<void> {
    const queue = await getQueue();
    const existing = queue.find(q => q.itemId === item.id && q.operation === 'create');
    if (existing) {
        existing.envelope = item.envelope;
        await saveQueue(queue);
        return;
    }
    queue.push({
        id: crypto.randomUUID(),
        operation: 'update',
        itemId: item.id,
        envelope: item.envelope,
        attempts: 0,
        createdAt: new Date().toISOString(),
    });
    await saveQueue(queue);
}

export async function enqueueDelete(itemId: string): Promise<void> {
    const queue = await getQueue();
    const filtered = queue.filter(q => q.itemId !== itemId && q.operation !== 'delete');
    filtered.push({
        id: crypto.randomUUID(),
        operation: 'delete',
        itemId,
        attempts: 0,
        createdAt: new Date().toISOString(),
    });
    await saveQueue(filtered);
}

let processing = false;

export async function processQueue(): Promise<{ processed: number; failed: number }> {
    if (processing) return { processed: 0, failed: 0 };
    processing = true;

    try {
        const queue = await getQueue();
        if (queue.length === 0) return { processed: 0, failed: 0 };

        let processed = 0;
        let failed = 0;
        const remaining: QueueEntry[] = [];

        for (const entry of queue) {
            try {
                switch (entry.operation) {
                    case 'create':
                        await apiCreateItem(entry.envelope);
                        break;
                    case 'update':
                        await apiUpdateItem(entry.itemId, entry.envelope);
                        break;
                    case 'delete':
                        await apiDeleteItem(entry.itemId);
                        break;
                }
                processed++;
            } catch (e) {
                entry.attempts++;
                if (entry.attempts >= MAX_RETRIES) {
                    console.warn(`Sync queue entry ${entry.id} exceeded max retries, dropping`);
                    failed++;
                } else {
                    remaining.push(entry);
                    const delay = RETRY_DELAYS[Math.min(entry.attempts - 1, RETRY_DELAYS.length - 1)];
                    console.warn(`Sync queue entry ${entry.id} failed (attempt ${entry.attempts}), retrying in ${delay}ms`);
                }
            }
        }

        await saveQueue(remaining);

        if (processed > 0) {
            await fullSync();
        }

        return { processed, failed };
    } finally {
        processing = false;
    }
}

export async function fullSync(): Promise<{ pushed: number; pulled: number }> {
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
        return { pushed: localItems.length, pulled: pullResp.items.length };
    } catch (e) {
        console.warn('Full sync failed:', e);
        return { pushed: 0, pulled: 0 };
    }
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(intervalMs: number = 60000): void {
    if (syncTimer) clearInterval(syncTimer);
    processQueue();
    syncTimer = setInterval(() => processQueue(), intervalMs);
}

export function stopAutoSync(): void {
    if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
    }
}
