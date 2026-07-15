import { localFetch } from './local-client';
import type { EncryptedVaultItem, SyncPushApiResponse, SyncPullApiResponse } from '../types';

// A push entry is either a full encrypted item or a deletion tombstone.
type SyncPushEntry = EncryptedVaultItem | { id: string; envelope: null; deletedAt: string };

// Vault sync now targets the local vault-warden identity-sync endpoints
// (POST /v1/identity/sync, GET /v1/identity/sync/changes) instead of the cloud
// API. The push/pull batch shape is unchanged, so the merge logic in
// sync-queue.ts is untouched.

export async function pushChanges(items: SyncPushEntry[], cursor: string | null): Promise<SyncPushApiResponse> {
    return localFetch('/identity/sync', {
        method: 'POST',
        body: JSON.stringify({ items, cursor }),
    });
}

export async function pullChanges(cursor: string | null): Promise<SyncPullApiResponse> {
    const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return localFetch(`/identity/sync/changes${params}`);
}
