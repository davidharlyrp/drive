import { X } from 'lucide-react';
import { useEffect } from 'react';

interface DeleteConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onClose: () => void;
    onConfirm: () => void;
    isLoading?: boolean;
}

export function DeleteConfirmModal({ isOpen, title, message, onClose, onConfirm, isLoading = false }: DeleteConfirmModalProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className="bg-white rounded-2xl shadow-premium w-full max-w-sm flex flex-col animate-in zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-5 flex justify-between items-center border-b border-surface-100">
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-lg font-bold text-surface-900">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-surface-400 hover:text-surface-900 hover:bg-surface-50 rounded-lg transition-colors"
                        disabled={isLoading}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6">
                    <p className="text-surface-600 font-medium leading-relaxed">{message}</p>
                </div>

                <div className="p-5 bg-surface-50 border-t border-surface-100 flex justify-end gap-3 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-white text-surface-700 border border-surface-200 hover:bg-surface-50 hover:text-surface-900 rounded-xl transition-all font-semibold text-sm shadow-sm"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-5 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-xl transition-all font-semibold text-sm shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Deleting...
                            </>
                        ) : 'Delete'}
                    </button>
                </div>
            </div>

            <div className="fixed inset-0 -z-10" onClick={onClose} />
        </div>
    );
}
