import { create } from 'zustand';

interface SessionStore {
    unlocked: boolean;
    deviceId: string | null;
    lastUnlockAt: number | null;
    setUnlocked: (unlocked: boolean) => void;
    setDeviceId: (deviceId: string | null) => void;
    lock: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
    unlocked: false,
    deviceId: null,
    lastUnlockAt: null,
    setUnlocked: (unlocked) => set({
        unlocked,
        lastUnlockAt: unlocked ? Date.now() : null,
    }),
    setDeviceId: (deviceId) => set({ deviceId }),
    lock: () => set({ unlocked: false, lastUnlockAt: null }),
}));
