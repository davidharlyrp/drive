import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface InputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (value: string) => void;
    title: string;
    defaultValue?: string;
    placeholder?: string;
    confirmLabel?: string;
}

export const InputModal: React.FC<InputModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    defaultValue = '',
    placeholder = 'Enter value...',
    confirmLabel = 'Confirm'
}) => {
    const [value, setValue] = useState(defaultValue);

    useEffect(() => {
        if (isOpen) {
            setValue(defaultValue);
        }
    }, [isOpen, defaultValue]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (value.trim()) {
            onConfirm(value.trim());
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div
                className="bg-white w-full max-w-sm rounded-2xl shadow-premium overflow-hidden animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-50">
                    <h3 className="text-lg font-bold text-surface-900 tracking-tight">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-surface-400 hover:text-surface-900 hover:bg-surface-50 p-1.5 rounded-lg transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-6">
                        <label className="block text-[10px] font-semibold text-surface-400 uppercase tracking-widest mb-2 ml-0.5">
                            {title} Name
                        </label>
                        <input
                            type="text"
                            autoFocus
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={placeholder}
                            className="w-full bg-surface-50/50 border border-surface-100 text-surface-900 text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-brand/40 focus:bg-white focus:ring-4 focus:ring-brand/5 transition-all placeholder-surface-300 font-medium shadow-sm"
                        />
                    </div>

                    <div className="flex justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-xs font-bold text-surface-500 hover:text-surface-900 hover:bg-surface-50 rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!value.trim()}
                            className="px-6 py-2.5 bg-brand hover:shadow-md hover:shadow-brand/20 disabled:opacity-50 disabled:grayscale text-white text-xs font-bold rounded-xl transition-all active:scale-95"
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
