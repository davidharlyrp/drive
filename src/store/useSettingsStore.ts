import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    gridColumns: number;
    setGridColumns: (columns: number) => void;
    showHidden: boolean;
    setShowHidden: (show: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            gridColumns: 6,
            setGridColumns: (columns) => set({ gridColumns: columns }),
            showHidden: false,
            setShowHidden: (show) => set({ showHidden: show }),
        }),
        {
            name: 'cloud-drive-settings',
        }
    )
);
