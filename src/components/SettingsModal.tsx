import React from 'react';
import { X, LogOut, LayoutGrid } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useNavigate } from 'react-router-dom';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { logout } = useAuthStore();
    const { gridColumns, setGridColumns } = useSettingsStore();
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleLogout = () => {
        logout();
        onClose();
        navigate('/login');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-premium overflow-hidden animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-50">
                    <h3 className="text-lg font-bold text-surface-900">Settings</h3>
                    <button onClick={onClose} className="text-surface-400 hover:text-surface-900 hover:bg-surface-50 p-1.5 rounded-lg transition-all">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5">
                    <div className="mb-5">
                        <div className="flex items-center gap-2 mb-2.5">
                            <LayoutGrid size={16} className="text-surface-500" />
                            <label className="text-xs font-semibold text-surface-500">Grid Columns</label>
                        </div>
                        <div className="flex items-center gap-1.5 bg-surface-50 p-1 rounded-xl border border-surface-100">
                            {[2, 3, 4, 5, 6, 8].map((col) => (
                                <button
                                    key={col}
                                    onClick={() => setGridColumns(col)}
                                    className={`flex-1 py-1.5 rounded-lg text-[13px] font-bold transition-all ${gridColumns === col
                                            ? 'bg-white text-brand shadow-sm border border-surface-200'
                                            : 'text-surface-500 hover:text-surface-900'
                                        }`}
                                >
                                    {col}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-surface-100">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all font-bold text-sm group active:scale-95"
                        >
                            <LogOut size={16} className="transition-transform group-hover:-translate-x-1" />
                            Log Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
