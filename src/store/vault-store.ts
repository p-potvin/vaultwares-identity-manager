import { create } from 'zustand';
import type { VaultItem, VaultSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

interface VaultStore {
    items: VaultItem[];
    settings: VaultSettings;
    loading: boolean;
    error: string | null;
    setItems: (items: VaultItem[]) => void;
    addItem: (item: VaultItem) => void;
    updateItem: (id: string, item: VaultItem) => void;
    removeItem: (id: string) => void;
    setSettings: (settings: VaultSettings) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
}

export const useVaultStore = create<VaultStore>((set) => ({
    items: [],
    settings: DEFAULT_SETTINGS,
    loading: false,
    error: null,
    setItems: (items) => set({ items }),
    addItem: (item) => set((s) => ({ items: [...s.items, item] })),
    updateItem: (id, item) => set((s) => ({
        items: s.items.map((i) => (i.id === id ? item : i)),
    })),
    removeItem: (id) => set((s) => ({
        items: s.items.filter((i) => i.id !== id),
    })),
    setSettings: (settings) => set({ settings }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
}));
