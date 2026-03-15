import React, { useState, useEffect, useCallback } from 'react';
import { Folder, ChevronRight, X, ChevronDown, HardDrive } from 'lucide-react';
import { pb } from '../lib/pb';
import { useAuthStore } from '../store/useAuthStore';
import type { RecordModel } from 'pocketbase';

interface MoveModalProps {
    itemsToMove: { type: 'folder' | 'file', id: string, name: string }[];
    onClose: () => void;
    onConfirm: (destinationId: string | '') => Promise<void>;
    isSharedView?: boolean;
    currentFolderId?: string;
}

export function MoveModal({ itemsToMove, onClose, onConfirm, isSharedView, currentFolderId }: MoveModalProps) {
    const [folders, setFolders] = useState<RecordModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFolderId, setSelectedFolderId] = useState<string | ''>('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [subFolders, setSubFolders] = useState<Record<string, RecordModel[]>>({});
    const { user } = useAuthStore();

    const fetchRootFolders = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            if (isSharedView) {
                // Fetch all shared folders where I am NOT the owner
                const allShared = await pb.collection('folders').getFullList({
                    filter: `shared_with ~ "${user.id}" && user_id != "${user.id}" && is_trash = false`,
                    sort: 'name'
                });
                const sharedIds = new Set(allShared.map(f => f.id));

                // Helper to verify if a parent is an entry point
                const entryPoints: any[] = [];
                for (const f of allShared) {
                    let isRoot = false;
                    if (!f.parent) {
                        isRoot = true;
                    } else if (!sharedIds.has(f.parent)) {
                        try {
                            const parent = await pb.collection('folders').getOne(f.parent);
                            isRoot = parent.user_id !== user.id;
                        } catch {
                            isRoot = true;
                        }
                    }
                    if (isRoot) entryPoints.push(f);
                }
                setFolders(entryPoints);
            }
            else {
                const res = await pb.collection('folders').getFullList({
                    filter: `parent = "" && user_id = "${user.id}" && is_trash = false`,
                    sort: 'name'
                });
                setFolders(res);
            }
        } catch (err) {
            console.error('Error fetching root folders:', err);
        } finally {
            setLoading(false);
        }
    }, [user, isSharedView]);

    useEffect(() => {
        fetchRootFolders();
    }, [fetchRootFolders]);

    const fetchSubFolders = async (parentId: string) => {
        if (subFolders[parentId] || !user) return;
        try {
            const filter = `parent = "${parentId}" && (user_id = "${user.id}" || shared_with ~ "${user.id}") && is_trash = false`;
            const res = await pb.collection('folders').getFullList({
                filter,
                sort: 'name'
            });
            setSubFolders(prev => ({ ...prev, [parentId]: res }));
        } catch (err) {
            console.error('Error fetching subfolders:', err);
        }
    };

    const toggleExpand = async (e: React.MouseEvent, folderId: string) => {
        e.stopPropagation();
        const newExpanded = new Set(expandedFolders);
        if (newExpanded.has(folderId)) {
            newExpanded.delete(folderId);
        } else {
            newExpanded.add(folderId);
            await fetchSubFolders(folderId);
        }
        setExpandedFolders(newExpanded);
    };

    const isDisabled = (folderId: string) => {
        // Prevent moving a folder into itself
        if (itemsToMove.some(item => item.type === 'folder' && item.id === folderId)) return true;
        // Prevent moving to the current folder
        if (folderId === currentFolderId) return true;
        return false;
    };

    const renderFolder = (folder: RecordModel, depth: number = 0) => {
        const isExpanded = expandedFolders.has(folder.id);
        const disabled = isDisabled(folder.id);
        const isSelected = selectedFolderId === folder.id;

        return (
            <div key={folder.id} className="select-none">
                <div
                    className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${isSelected
                        ? 'bg-brand/5 border border-brand/20 shadow-sm'
                        : 'hover:bg-surface-50 text-surface-600'
                        } ${disabled ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
                    style={{ marginLeft: `${depth * 20}px` }}
                    onClick={() => !disabled && setSelectedFolderId(folder.id)}
                >
                    <button
                        className="p-1.5 hover:bg-surface-100 rounded-lg transition-all text-surface-400"
                        onClick={(e) => toggleExpand(e, folder.id)}
                    >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <Folder size={20} className={isSelected ? 'text-brand fill-brand/10' : 'text-surface-400'} />
                    <span className={`text-sm font-semibold truncate ${isSelected ? 'text-brand' : 'text-surface-900'}`}>{folder.name}</span>
                </div>
                {isExpanded && subFolders[folder.id] && (
                    <div className="mt-1">
                        {subFolders[folder.id].map(sub => renderFolder(sub, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] shadow-premium w-full max-w-lg flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300 overflow-hidden">
                <div className="flex items-center justify-between px-8 py-6 border-b border-surface-100 bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="text-xl font-bold text-surface-900">Move Items</h3>
                        <p className="text-xs font-semibold text-surface-400 mt-0.5">Moving {itemsToMove.length} item{itemsToMove.length > 1 ? 's' : ''}</p>
                    </div>
                    <button onClick={onClose} className="text-surface-400 hover:text-surface-900 hover:bg-surface-50 p-2 rounded-full transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-2 bg-white custom-scrollbar">
                    {!isSharedView && (
                        <>
                            <div
                                className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all ${selectedFolderId === '' ? 'bg-brand/5 border border-brand/20 shadow-sm' : 'hover:bg-surface-50 text-surface-600'
                                    }`}
                                onClick={() => setSelectedFolderId('')}
                            >
                                <div className="w-8" /> {/* Spacer for chevron align */}
                                <HardDrive size={20} className={selectedFolderId === '' ? 'text-brand' : 'text-surface-400'} />
                                <span className={`text-sm font-bold ${selectedFolderId === '' ? 'text-brand' : 'text-surface-900'}`}>My Files (Root)</span>
                            </div>
                            <div className="h-px bg-surface-100 my-4 mx-2"></div>
                        </>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="animate-spin w-8 h-8 border-3 border-brand border-t-transparent rounded-full"></div>
                            <span className="text-xs font-bold text-surface-400 animate-pulse">Scanning folders...</span>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {folders.map(folder => renderFolder(folder))}
                        </div>
                    )}
                </div>

                <div className="px-8 py-6 border-t border-surface-100 flex justify-end gap-3 bg-surface-50/50">
                    <button
                        className="px-6 py-3 text-sm font-bold text-surface-500 hover:text-surface-900 hover:bg-white rounded-2xl border border-transparent hover:border-surface-200 transition-all"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className="px-8 py-3 bg-brand hover:shadow-lg hover:shadow-brand/20 text-white text-sm font-bold rounded-2xl transition-all active:scale-95 flex items-center gap-2"
                        onClick={() => onConfirm(selectedFolderId)}
                    >
                        Move Items Here
                    </button>
                </div>
            </div>
        </div>
    );
}
