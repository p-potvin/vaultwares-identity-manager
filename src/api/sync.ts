import { apiFetch } from './client';
import type { EncryptedVaultItem, SyncPushApiResponse, SyncPullApiResponse } from '../types';

export async function pushChanges(items: EncryptedVaultItem[], cursor: string | null): Promise<SyncPushApiResponse> {
    return apiFetch('/vault/sync', {
        method: 'POST',
        body: JSON.stringify({ items, cursor }),
    });
}

export async function pullChanges(cursor: string | null): Promise<SyncPullApiResponse> {
    const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return apiFetch(`/vault/sync/changes${params}`);
}
