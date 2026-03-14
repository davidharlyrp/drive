import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    gridColumns: number;
    setGridColumns: (columns: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            gridColumns: 6,
            setGridColumns: (columns) => set({ gridColumns: columns }),
        }),
        {
            name: 'cloud-drive-settings',
        }
    )
);
