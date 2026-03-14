import { create } from 'zustand';
import type { RecordModel } from 'pocketbase';

interface AuthState {
    user: RecordModel | null;
    token: string | null;
    isAuthenticated: boolean;
    setUser: (user: RecordModel | null, token: string | null) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    isAuthenticated: false,
    setUser: (user, token) => set({ user, token, isAuthenticated: !!user && !!token }),
    logout: () => set({ user: null, token: null, isAuthenticated: false }),
}));
