import { create } from 'zustand';
import type { RecordModel } from 'pocketbase';
import { pb } from '../lib/pb';

interface AuthState {
    user: RecordModel | null;
    token: string | null;
    isAuthenticated: boolean;
    storageUsed: number;
    setUser: (user: RecordModel | null, token: string | null) => void;
    updateStorage: () => Promise<void>;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: pb.authStore.model,
    token: pb.authStore.token,
    isAuthenticated: pb.authStore.isValid,
    storageUsed: 0,
    setUser: (user, token) => set({ user, token, isAuthenticated: !!user && !!token }),
    updateStorage: async () => {
        const { user } = get();
        if (!user) return;
        try {
            const allFiles = await pb.collection('files').getFullList({
                filter: `user_id = "${user.id}"`,
                fields: 'size'
            });
            const total = allFiles.reduce((acc, file) => acc + (file.size || 0), 0);
            set({ storageUsed: total });
        } catch (error) {
            console.error('Error updating storage:', error);
        }
    },
    logout: () => {
        pb.authStore.clear();
        set({ user: null, token: null, isAuthenticated: false, storageUsed: 0 });
    },
}));
