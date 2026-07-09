import { apiFetch } from './client';
import type { VaultItemResponse, VaultItemListResponse, VaultEnvelope } from '../types';

export async function createVaultItem(envelope: VaultEnvelope): Promise<VaultItemResponse> {
    return apiFetch('/vault/items', {
        method: 'POST',
        body: JSON.stringify({ envelope }),
    });
}

export async function updateVaultItem(id: string, envelope: VaultEnvelope): Promise<VaultItemResponse> {
    return apiFetch(`/vault/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ envelope }),
    });
}

export async function deleteVaultItem(id: string): Promise<void> {
    await apiFetch(`/vault/items/${id}`, { method: 'DELETE' });
}

export async function getVaultItem(id: string): Promise<VaultItemResponse> {
    return apiFetch(`/vault/items/${id}`);
}

export async function listVaultItems(): Promise<VaultItemListResponse> {
    return apiFetch('/vault/items');
}
