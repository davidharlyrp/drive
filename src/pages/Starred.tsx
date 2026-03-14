import { useState, useEffect, useMemo, useRef } from 'react';
import { LayoutGrid, List, CheckSquare, Square, Star, MoreVertical, Edit2, FolderInput, Trash2, Download, File as FileIcon, Folder as FolderIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStorage } from '../hooks/useStorage';
import type { RecordModel } from 'pocketbase';
import { pb } from '../lib/pb';
import { useAuthStore } from '../store/useAuthStore';
import { FileViewerModal } from '../components/FileViewerModal';
import { MoveModal } from '../components/MoveModal';
import { InputModal } from '../components/InputModal';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSearchStore } from '../store/useSearchStore';
import { moveToTrash } from '../utils/trashHelper';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { downloadItemsAsZip, downloadSingleFile, type DownloadTask } from '../utils/downloadHelper';
import { DownloadProgressModal } from '../components/DownloadProgressModal';
import { toggleStarred } from '../utils/starredHelper';

export default function Starred() {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const { folders, files, loading, loadingMore, hasMore, loadMore, totalFiles, refetch } = useStorage('root', false, true);
    const { user, updateStorage } = useAuthStore();
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const { gridColumns } = useSettingsStore();
    const { searchQuery } = useSearchStore();
    const [previewFile, setPreviewFile] = useState<RecordModel | null>(null);
    const [selectedItems, setSelectedItems] = useState<{ type: 'folder' | 'file', id: string }[]>([]);

    const gridColumnClass = {
        2: 'grid-cols-2',
        3: 'grid-cols-2 sm:grid-cols-3',
        4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
        5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
        6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
        8: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
    }[gridColumns] || 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';

    const [itemsToMove, setItemsToMove] = useState<{ type: 'folder' | 'file', id: string, name: string }[] | null>(null);
    const [inputModal, setInputModal] = useState<{
        isOpen: boolean;
        title: string;
        defaultValue: string;
        placeholder?: string;
        onConfirm: (value: string) => void;
    }>({
        isOpen: false,
        title: '',
        defaultValue: '',
        onConfirm: () => { }
    });
    const [deleteModal, setDeleteModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        items: { type: 'folder' | 'file', id: string }[];
        isDeleting: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        items: [],
        isDeleting: false
    });
    const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
    const [totalDownloadFiles, setTotalDownloadFiles] = useState(0);

    // Clear selection on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSelectedItems([]);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Intersection Observer for infinite scroll
    useEffect(() => {
        if (!hasMore || loading || loadingMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMore();
                }
            },
            { threshold: 1.0, rootMargin: '100px' }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [hasMore, loading, loadingMore, loadMore]);

    const sortedFolders = useMemo(() => {
        return [...folders]
            .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [folders, searchQuery]);

    const sortedFiles = useMemo(() => {
        return [...files]
            .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [files, searchQuery]);

    const handleConfirmMove = async (destinationId: string | '') => {
        if (!itemsToMove) return;
        try {
            for (const item of itemsToMove) {
                const collection = item.type === 'folder' ? 'folders' : 'files';
                const data = item.type === 'folder' ? { parent: destinationId } : { folder_id: destinationId };
                await pb.collection(collection).update(item.id, data);
            }
            setItemsToMove(null);
            setSelectedItems([]);
            refetch();
        } catch (err: any) {
            alert('Move failed: ' + err.message);
        }
    };

    const toggleSelection = (type: 'folder' | 'file', id: string) => {
        setSelectedItems(prev => {
            const exists = prev.find(i => i.id === id);
            if (exists) return prev.filter(i => i.id !== id);
            return [...prev, { type, id }];
        });
    };

    const handleRename = (type: 'folder' | 'file', id: string, name: string) => {
        setInputModal({
            isOpen: true,
            title: `Rename ${type}`,
            defaultValue: name,
            onConfirm: async (newName) => {
                try {
                    const collection = type === 'folder' ? 'folders' : 'files';
                    await pb.collection(collection).update(id, { name: newName });
                    refetch();
                } catch (e: any) { alert(e.message); }
            }
        });
    };

    const confirmDeleteItems = async () => {
        if (!deleteModal.items.length) return;
        setDeleteModal(prev => ({ ...prev, isDeleting: true }));
        try {
            await moveToTrash(deleteModal.items, user!.id);
            setDeleteModal(prev => ({ ...prev, isOpen: false }));
            setSelectedItems([]);
            refetch();
            updateStorage();
        } catch (err: any) {
            alert('Delete failed: ' + err.message);
        } finally {
            setDeleteModal(prev => ({ ...prev, isDeleting: false }));
        }
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-100 shadow-sm">
                        <Star size={22} className="fill-amber-500" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-surface-900">Starred</h1>
                        <p className="text-xs font-medium text-surface-400">Quick access to your favorite items</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-white border border-surface-200 rounded-xl p-1 shadow-sm">
                        <button
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-brand/10 text-brand' : 'text-surface-400 hover:text-surface-900'} `}
                            onClick={() => setViewMode('list')}
                        >
                            <List size={20} />
                        </button>
                        <button
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-brand/10 text-brand' : 'text-surface-400 hover:text-surface-900'} `}
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-1 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="animate-spin w-10 h-10 border-4 border-brand border-t-transparent rounded-full"></div>
                        <span className="text-xs font-semibold text-surface-400 animate-pulse tracking-widest uppercase">Loading starred items...</span>
                    </div>
                ) : sortedFolders.length === 0 && sortedFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white border border-surface-100 rounded-2xl shadow-soft animate-in fade-in duration-500 mx-auto max-w-2xl mt-12">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-amber-100/50 blur-2xl rounded-full"></div>
                            <Star className="w-16 h-16 text-amber-400 relative z-10" />
                        </div>
                        <h3 className="text-xl font-bold text-surface-900 mb-2">No starred items</h3>
                        <p className="text-sm font-medium text-surface-400 mb-8 max-w-[280px] text-center">
                            Items you star will appear here for quick access.
                        </p>
                    </div>
                ) : (
                    <div className={viewMode === 'grid' ? `grid ${gridColumnClass} gap-5 pb-10` : "flex flex-col gap-2 pb-10"}>
                        {sortedFolders.map(folder => (
                            <FolderItem
                                key={folder.id}
                                folder={folder}
                                viewMode={viewMode}
                                isSelected={selectedItems.some(item => item.id === folder.id)}
                                onToggleSelect={() => toggleSelection('folder', folder.id)}
                                onRename={(id, name) => handleRename('folder', id, name)}
                                onMove={() => setItemsToMove([{ type: 'folder', id: folder.id, name: folder.name }])}
                                onDelete={() => setDeleteModal({
                                    isOpen: true,
                                    title: 'Move Folder to Trash',
                                    message: `Are you sure you want to move "${folder.name}" to the trash?`,
                                    items: [{ type: 'folder', id: folder.id }],
                                    isDeleting: false
                                })}
                                onDownloadZip={() => downloadItemsAsZip([{ type: 'folder', id: folder.id, name: folder.name }], `${folder.name}.zip`, () => { })}
                                onClick={() => {
                                    if (selectedItems.length > 0) {
                                        toggleSelection('folder', folder.id);
                                    } else {
                                        navigate(`/files/${folder.id}`);
                                    }
                                }}
                                onUnstar={async () => {
                                    await toggleStarred([{ type: 'folder', id: folder.id }], false, user!.id);
                                    refetch();
                                }}
                            />
                        ))}
                        {sortedFiles.map(file => (
                            <FileItem
                                key={file.id}
                                file={file}
                                viewMode={viewMode}
                                isSelected={selectedItems.some(item => item.id === file.id)}
                                onToggleSelect={() => toggleSelection('file', file.id)}
                                onRename={(id, name) => handleRename('file', id, name)}
                                onMove={() => setItemsToMove([{ type: 'file', id: file.id, name: file.name }])}
                                onDelete={() => setDeleteModal({
                                    isOpen: true,
                                    title: 'Move File to Trash',
                                    message: `Are you sure you want to move "${file.name}" to the trash?`,
                                    items: [{ type: 'file', id: file.id }],
                                    isDeleting: false
                                })}
                                onClick={() => {
                                    if (selectedItems.length > 0) {
                                        toggleSelection('file', file.id);
                                    } else {
                                        setPreviewFile(file);
                                    }
                                }}
                                onUnstar={async () => {
                                    await toggleStarred([{ type: 'file', id: file.id }], false, user!.id);
                                    refetch();
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Sentinel for infinite scroll */}
                {hasMore && (
                    <div ref={loadMoreRef} className="py-8 flex justify-center">
                        {loadingMore && (
                            <div className="flex items-center gap-3 text-surface-400">
                                <div className="animate-spin w-5 h-5 border-2 border-brand border-t-transparent rounded-full"></div>
                                <span className="text-sm font-medium">Loading more items...</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {previewFile && (
                <FileViewerModal
                    file={previewFile}
                    files={files}
                    onClose={() => setPreviewFile(null)}
                    onRefetch={refetch}
                    onRename={(file) => handleRename('file', file.id, file.name)}
                    onMove={(file) => setItemsToMove([{ type: 'file', id: file.id, name: file.name }])}
                    onDownload={(file) => downloadSingleFile(file)}
                    onDelete={(file) => setDeleteModal({
                        isOpen: true,
                        title: 'Move File to Trash',
                        message: `Are you sure you want to move this file to the trash?`,
                        items: [{ type: 'file', id: file.id }],
                        isDeleting: false
                    })}
                    totalFiles={totalFiles}
                    hasMore={hasMore}
                    onLoadMore={loadMore}
                />
            )}

            {itemsToMove && (
                <MoveModal
                    itemsToMove={itemsToMove}
                    onClose={() => setItemsToMove(null)}
                    onConfirm={handleConfirmMove}
                />
            )}

            <InputModal
                isOpen={inputModal.isOpen}
                onClose={() => setInputModal(prev => ({ ...prev, isOpen: false }))}
                title={inputModal.title}
                defaultValue={inputModal.defaultValue}
                placeholder={inputModal.placeholder}
                onConfirm={inputModal.onConfirm}
            />

            <DeleteConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmDeleteItems}
                title={deleteModal.title}
                message={deleteModal.message}
                isLoading={deleteModal.isDeleting}
            />

            <DownloadProgressModal
                tasks={downloadTasks}
                totalFiles={totalDownloadFiles}
                onClose={() => {
                    setDownloadTasks([]);
                    setTotalDownloadFiles(0);
                }}
            />
        </div>
    );
}

function FolderItem({ folder, viewMode, onClick, isSelected, onToggleSelect, onRename, onMove, onDelete, onDownloadZip, onUnstar }: { folder: RecordModel, viewMode: 'grid' | 'list', onClick: () => void, isSelected: boolean, onToggleSelect: () => void, onRename: (id: string, name: string) => void, onMove: () => void, onDelete: () => void, onDownloadZip: () => void, onUnstar: () => void }) {
    const [showMenu, setShowMenu] = useState(false);

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleSelect();
    };

    const handleRenameClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onRename(folder.id, folder.name);
        setShowMenu(false);
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDownloadZip();
        setShowMenu(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
        setShowMenu(false);
    };

    const handleUnstar = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUnstar();
        setShowMenu(false);
    };

    if (viewMode === 'list') {
        return (
            <div
                className={`flex items-center justify-between p-3.5 bg-white border ${isSelected ? 'border-brand bg-brand/5 shadow-sm shadow-brand/5' : 'border-surface-100'} rounded-xl hover:border-brand/30 hover:shadow-soft cursor-pointer transition-all group`}
                onClick={onClick}
            >
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSelect}
                        className={`transition-colors ${isSelected ? 'text-brand' : 'text-surface-300 hover:text-brand outline-none'}`}
                    >
                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} className="group-hover:opacity-100" />}
                    </button>
                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-50 text-brand">
                        <FolderIcon size={22} className="fill-brand/20" />
                    </div>
                    <span className="text-sm font-semibold text-surface-900 truncate max-w-[200px]">{folder.name}</span>
                </div>
                <div className="relative">
                    <button
                        className="text-surface-400 hover:text-surface-900 hover:bg-surface-50 p-1.5 rounded-lg transition-all"
                        onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    >
                        <MoreVertical size={18} />
                    </button>
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}></div>
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-surface-100 rounded-2xl shadow-premium z-20 py-2 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleUnstar}>
                                    <Star size={16} className="text-amber-500 fill-amber-500" /> Unstar
                                </button>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleDownload}>
                                    <Download size={16} className="text-surface-400" /> Download ZIP
                                </button>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleRenameClick}>
                                    <Edit2 size={16} className="text-surface-400" /> Rename
                                </button>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={(e) => { e.stopPropagation(); onMove(); setShowMenu(false); }}>
                                    <FolderInput size={16} className="text-surface-400" /> Move
                                </button>
                                <div className="h-px bg-surface-100 my-1 mx-2"></div>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors" onClick={handleDelete}>
                                    <Trash2 size={16} /> Delete
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex flex-col p-4 bg-white border ${isSelected ? 'border-brand bg-brand/5 shadow-md shadow-brand/10' : 'border-surface-100'} rounded-2xl hover:border-brand/30 hover:shadow-premium cursor-pointer transition-all relative group`}
            onClick={onClick}
        >
            <div className="flex justify-between items-start mb-4">
                <button
                    onClick={handleSelect}
                    className={`transition-colors h-6 ${isSelected ? 'text-brand' : 'text-surface-300 hover:text-brand outline-none'}`}
                >
                    {isSelected ? <CheckSquare size={20} /> : <Square size={20} className="group-hover:opacity-100" />}
                </button>

                <div className="relative">
                    <button
                        className="text-surface-400 hover:text-surface-900 hover:bg-surface-50 p-1.5 rounded-lg transition-all"
                        onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    >
                        <MoreVertical size={18} />
                    </button>
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}></div>
                            <div className="absolute right-0 top-10 w-48 bg-white border border-surface-100 rounded-2xl shadow-premium z-20 py-2 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleUnstar}>
                                    <Star size={16} className="text-amber-500 fill-amber-500" /> Unstar
                                </button>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleDownload}>
                                    <Download size={16} className="text-surface-400" /> Download ZIP
                                </button>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleRenameClick}>
                                    <Edit2 size={16} className="text-surface-400" /> Rename
                                </button>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={(e) => { e.stopPropagation(); onMove(); setShowMenu(false); }}>
                                    <FolderInput size={16} className="text-surface-400" /> Move
                                </button>
                                <div className="h-px bg-surface-100 my-1 mx-2"></div>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors" onClick={handleDelete}>
                                    <Trash2 size={16} /> Delete
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="w-full aspect-square flex items-center justify-center bg-indigo-50/50 rounded-2xl border border-indigo-100/50 mb-3 group-hover:shadow-inner transition-all">
                <FolderIcon size={48} className="text-brand fill-brand/10 group-hover:scale-110 transition-transform duration-300" />
            </div>

            <span className="text-sm font-semibold text-surface-900 truncate px-1">{folder.name}</span>
        </div>
    );
}

function FileItem({ file, viewMode, onClick, isSelected, onToggleSelect, onRename, onMove, onDelete, onUnstar }: { file: RecordModel, viewMode: 'grid' | 'list', onClick: () => void, isSelected: boolean, onToggleSelect: () => void, onRename: (id: string, name: string) => void, onMove: () => void, onDelete: () => void, onUnstar: () => void }) {
    const [showMenu, setShowMenu] = useState(false);
    const isImage = file.type?.startsWith('image/') || false;
    const isVideo = file.type?.startsWith('video/') || false;
    const fileUrl = pb.files.getURL(file, file.file);
    const thumbnailUrl = isImage ? pb.files.getURL(file, file.file, { thumb: '400x400' }) : (isVideo ? `${fileUrl}#t=0.001` : null);

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleSelect();
    };

    const handleRenameClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onRename(file.id, file.name);
        setShowMenu(false);
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        downloadSingleFile(file);
        setShowMenu(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
        setShowMenu(false);
    };

    const handleUnstar = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUnstar();
        setShowMenu(false);
    };

    if (viewMode === 'list') {
        return (
            <div
                className={`flex items-center justify-between p-3 bg-white border ${isSelected ? 'border-brand bg-brand/5 shadow-sm shadow-brand/5' : 'border-surface-100'} rounded-xl hover:border-brand/30 hover:shadow-soft cursor-pointer transition-all group`}
                onClick={onClick}
            >
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSelect}
                        className={`transition-colors ${isSelected ? 'text-brand' : 'text-surface-300 hover:text-brand outline-none'}`}
                    >
                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} className="group-hover:opacity-100" />}
                    </button>
                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-50 overflow-hidden border border-surface-100">
                        {isImage && thumbnailUrl ? (
                            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : isVideo ? (
                            <video src={thumbnailUrl || ''} className="w-full h-full object-cover" preload="metadata" muted playsInline />
                        ) : (
                            <FileIcon className="text-surface-400" size={20} />
                        )}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-surface-900 truncate max-w-[200px]">{file.name}</span>
                        <span className="text-[10px] text-surface-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                </div>
                <div className="relative">
                    <button
                        className="text-surface-400 hover:text-surface-900 hover:bg-surface-50 p-1.5 rounded-lg transition-all"
                        onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    >
                        <MoreVertical size={18} />
                    </button>
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}></div>
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-surface-100 rounded-2xl shadow-premium z-20 py-2 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleUnstar}>
                                    <Star size={16} className="text-amber-500 fill-amber-500" /> Unstar
                                </button>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleDownload}>
                                    <Download size={16} className="text-surface-400" /> Download
                                </button>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleRenameClick}>
                                    <Edit2 size={16} className="text-surface-400" /> Rename
                                </button>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={(e) => { e.stopPropagation(); onMove(); setShowMenu(false); }}>
                                    <FolderInput size={16} className="text-surface-400" /> Move
                                </button>
                                <div className="h-px bg-surface-100 my-1 mx-2"></div>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors" onClick={handleDelete}>
                                    <Trash2 size={16} /> Delete
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex flex-col p-3 bg-white border ${isSelected ? 'border-brand bg-brand/5 shadow-md shadow-brand/10' : 'border-surface-100'} rounded-2xl hover:border-brand/30 hover:shadow-premium cursor-pointer transition-all relative group`}
            onClick={onClick}
        >
            <div className="flex justify-between items-start mb-2">
                <button
                    onClick={handleSelect}
                    className={`transition-colors h-6 ${isSelected ? 'text-brand' : 'text-surface-300 hover:text-brand outline-none'}`}
                >
                    {isSelected ? <CheckSquare size={20} /> : <Square size={20} className="group-hover:opacity-100" />}
                </button>

                <div className="relative">
                    <button
                        className="text-surface-400 hover:text-surface-900 hover:bg-surface-50 p-1.5 rounded-lg transition-all"
                        onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    >
                        <MoreVertical size={18} />
                    </button>
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}></div>
                            <div className="absolute right-0 top-10 w-48 bg-white border border-surface-100 rounded-2xl shadow-premium z-20 py-2 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleUnstar}>
                                    <Star size={16} className="text-amber-500 fill-amber-500" /> Unstar
                                </button>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleDownload}>
                                    <Download size={16} className="text-surface-400" /> Download
                                </button>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleRenameClick}>
                                    <Edit2 size={16} className="text-surface-400" /> Rename
                                </button>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={(e) => { e.stopPropagation(); onMove(); setShowMenu(false); }}>
                                    <FolderInput size={16} className="text-surface-400" /> Move
                                </button>
                                <div className="h-px bg-surface-100 my-1 mx-2"></div>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors" onClick={handleDelete}>
                                    <Trash2 size={16} /> Delete
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="w-full aspect-square flex items-center justify-center bg-surface-50 rounded-2xl border border-surface-100 overflow-hidden mb-3 group-hover:shadow-inner transition-all">
                {isImage && thumbnailUrl ? (
                    <img src={thumbnailUrl} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : isVideo ? (
                    <video src={thumbnailUrl || ''} className="w-full h-full object-cover" preload="metadata" muted playsInline />
                ) : (
                    <FileIcon className="text-surface-400 group-hover:scale-110 transition-transform duration-300" size={32} />
                )}
            </div>

            <div className="flex flex-col px-1">
                <span className="text-sm font-semibold text-surface-900 truncate mb-0.5">{file.name}</span>
                <span className="text-[11px] text-surface-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
        </div>
    );
}
