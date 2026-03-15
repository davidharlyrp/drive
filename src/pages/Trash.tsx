import { useState, useEffect, useRef } from 'react';
import { LayoutGrid, List, ArrowDownUp, File as FileIcon, Folder as FolderIcon, MoreVertical, Trash2, CheckSquare, Square, FolderInput, Calendar, Type, Database, ArrowDown, ArrowUp, FileSpreadsheet, FileEdit, Presentation } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStorage } from '../hooks/useStorage';
import type { RecordModel } from 'pocketbase';
import { pb } from '../lib/pb';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSearchStore } from '../store/useSearchStore';
import { restoreFromTrash, permanentDelete } from '../utils/trashHelper';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { useMemo } from 'react';

export default function Trash() {
    const { folderId } = useParams();
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const { showHidden } = useSettingsStore();
    const { folders, files, breadcrumbs, loading, loadingMore, hasMore, loadMore, refetch } = useStorage(folderId || 'root', true, false, false, showHidden);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const { user, updateStorage } = useAuthStore();
    const { gridColumns } = useSettingsStore();
    const { searchQuery } = useSearchStore();
    const [selectedItems, setSelectedItems] = useState<{ type: 'folder' | 'file', id: string }[]>([]);
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

    const gridColumnClass = {
        2: 'grid-cols-2',
        3: 'grid-cols-2 sm:grid-cols-3',
        4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
        5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
        6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
        8: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
    }[gridColumns] || 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';

    const [sortType, setSortType] = useState<'name' | 'date' | 'size'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [showSortMenu, setShowSortMenu] = useState(false);

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

    useEffect(() => {
        setSelectedItems([]);
    }, [folderId]);


    const handleFolderClick = (id: string) => {
        navigate(`/trash/${id}`);
    };

    const toggleSelection = (type: 'folder' | 'file', id: string) => {
        setSelectedItems(prev => {
            const exists = prev.find(item => item.id === id);
            if (exists) return prev.filter(item => item.id !== id);
            return [...prev, { type, id }];
        });
    };

    const handleBatchDelete = () => {
        if (!selectedItems.length) return;
        setDeleteModal({
            isOpen: true,
            title: 'Delete Permanently',
            message: `Are you sure you want to permanently delete ${selectedItems.length} selected items? This action cannot be undone.`,
            items: selectedItems,
            isDeleting: false
        });
    };

    const confirmDeleteItems = async () => {
        setDeleteModal(prev => ({ ...prev, isDeleting: true }));
        try {
            await permanentDelete(deleteModal.items, user!.id);
            setSelectedItems([]);
            refetch();
            updateStorage();
            setDeleteModal(prev => ({ ...prev, isOpen: false, isDeleting: false }));
        } catch (err: any) {
            alert('Delete failed: ' + err.message);
            setDeleteModal(prev => ({ ...prev, isDeleting: false }));
            refetch();
        }
    };

    const handleBatchRestore = async () => {
        if (!selectedItems.length || !user) return;
        try {
            await restoreFromTrash(selectedItems, user.id);
            setSelectedItems([]);
            refetch();
            updateStorage();
        } catch (err: any) {
            alert('Batch restore failed: ' + err.message);
        }
    };

    const handleSelectAll = () => {
        const totalItems = sortedFolders.length + sortedFiles.length;
        if (selectedItems.length === totalItems && totalItems > 0) {
            setSelectedItems([]);
        } else {
            const allItems: { type: 'folder' | 'file', id: string }[] = [
                ...sortedFolders.map(f => ({ type: 'folder' as const, id: f.id })),
                ...sortedFiles.map(f => ({ type: 'file' as const, id: f.id }))
            ];
            setSelectedItems(allItems);
        }
    };

    const sortedFolders = useMemo(() => {
        return [...folders]
            .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => {
                let comparison = 0;
                if (sortType === 'name') comparison = a.name.localeCompare(b.name);
                else if (sortType === 'date') comparison = new Date(a.created).getTime() - new Date(b.created).getTime();

                return sortOrder === 'asc' ? comparison : -comparison;
            });
    }, [folders, sortType, sortOrder, searchQuery]);

    const sortedFiles = useMemo(() => {
        return [...files]
            .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => {
                let comparison = 0;
                if (sortType === 'name') comparison = a.name.localeCompare(b.name);
                else if (sortType === 'date') comparison = new Date(a.created).getTime() - new Date(b.created).getTime();
                else if (sortType === 'size') comparison = a.size - b.size;

                return sortOrder === 'asc' ? comparison : -comparison;
            });
    }, [files, sortType, sortOrder, searchQuery]);


    return (
        <div className="flex flex-col h-full relative">
            {/* Breadcrumbs */}
            <div className="flex items-center text-sm mb-2 text-surface-400 overflow-x-auto whitespace-nowrap pb-2 scrollbar-none">
                <span
                    className="hover:text-brand cursor-pointer transition-colors font-medium flex items-center gap-1.5"
                    onClick={() => navigate('/trash/root')}
                >
                    <Trash2 size={16} />
                    Trash
                </span>
                {breadcrumbs.map((crumb) => (
                    <div key={crumb.id} className="flex items-center">
                        <span className="mx-3 text-surface-300">/</span>
                        <span
                            className={`hover: text - brand cursor - pointer transition - colors ${crumb.id === folderId ? 'text-brand font-semibold' : 'font-medium'} `}
                            onClick={() => navigate(`/trash/${crumb.id}`)}
                        >
                            {crumb.name}
                        </span>
                    </div>
                ))}
                {loading && breadcrumbs.length === 0 && folderId !== 'root' && (
                    <span className="mx-3 text-surface-300 animate-pulse">/ ...</span>
                )}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-surface-200">
                <div className="flex items-center gap-3">
                    {(sortedFolders.length > 0 || sortedFiles.length > 0) && (
                        <button
                            className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-all text-sm font-medium ${selectedItems.length > 0 ? 'bg-brand/10 border-brand/30 text-brand shadow-sm shadow-brand/10' : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50 hover:border-surface-300 hover:shadow-sm'} `}
                            onClick={handleSelectAll}
                        >
                            {selectedItems.length === (sortedFolders.length + sortedFiles.length) && (sortedFolders.length + sortedFiles.length) > 0 ? (
                                <CheckSquare size={18} />
                            ) : (
                                <Square size={18} />
                            )}
                            <span>{selectedItems.length === (sortedFolders.length + sortedFiles.length) && (sortedFolders.length + sortedFiles.length) > 0 ? 'Deselect All' : 'Select All'}</span>
                        </button>
                    )}
                    {selectedItems.length > 0 && (
                        <div className="flex items-center gap-2 animate-in slide-in-from-left-4 fade-in duration-300">
                            <div className="w-px h-6 bg-surface-200 mx-1"></div>
                            <button
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100 rounded-xl transition-all text-sm font-medium shadow-sm active:scale-95"
                                onClick={handleBatchRestore}
                            >
                                <FolderInput size={18} />
                                <span>Restore ({selectedItems.length})</span>
                            </button>
                            <button
                                className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-xl transition-all text-sm font-medium shadow-sm shadow-red-100/50 active:scale-95"
                                onClick={handleBatchDelete}
                            >
                                <Trash2 size={18} />
                                <span>Delete Permanently ({selectedItems.length})</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3 relative">
                    <div className="relative">
                        <button
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-medium border ${showSortMenu ? 'border-brand bg-brand/5 text-brand shadow-sm shadow-brand/10' : 'bg-white border-surface-200 text-surface-600 hover:border-surface-300'} `}
                            title="Sort"
                            onClick={() => setShowSortMenu(!showSortMenu)}
                        >
                            <ArrowDownUp size={18} />
                            <span className="hidden sm:inline capitalize">{sortType}</span>
                            {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                        </button>

                        {showSortMenu && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)}></div>
                                <div className="absolute right-0 top-12 w-56 bg-white border border-surface-100 rounded-2xl shadow-premium z-20 py-2 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                    <div className="px-4 py-2 text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Sort By</div>
                                    <button
                                        className={`px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${sortType === 'name' ? 'text-brand bg-brand/5 font-semibold' : 'text-surface-600 hover:bg-surface-50'} `}
                                        onClick={() => { setSortType('name'); setShowSortMenu(false); }}
                                    >
                                        <div className="flex items-center gap-3"><Type size={18} /> Name</div>
                                        {sortType === 'name' && <div className="w-1.5 h-1.5 rounded-full bg-brand"></div>}
                                    </button>
                                    <button
                                        className={`px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${sortType === 'date' ? 'text-brand bg-brand/5 font-semibold' : 'text-surface-600 hover:bg-surface-50'} `}
                                        onClick={() => { setSortType('date'); setShowSortMenu(false); }}
                                    >
                                        <div className="flex items-center gap-3"><Calendar size={18} /> Date Created</div>
                                        {sortType === 'date' && <div className="w-1.5 h-1.5 rounded-full bg-brand"></div>}
                                    </button>
                                    <button
                                        className={`px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${sortType === 'size' ? 'text-brand bg-brand/5 font-semibold' : 'text-surface-600 hover:bg-surface-50'} `}
                                        onClick={() => { setSortType('size'); setShowSortMenu(false); }}
                                    >
                                        <div className="flex items-center gap-3"><Database size={18} /> Size</div>
                                        {sortType === 'size' && <div className="w-1.5 h-1.5 rounded-full bg-brand"></div>}
                                    </button>

                                    <div className="h-px bg-surface-100 my-2 mx-2"></div>
                                    <div className="px-4 py-2 text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Order</div>
                                    <button
                                        className={`px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${sortOrder === 'asc' ? 'text-brand bg-brand/5 font-semibold' : 'text-surface-600 hover:bg-surface-50'} `}
                                        onClick={() => { setSortOrder('asc'); setShowSortMenu(false); }}
                                    >
                                        <div className="flex items-center gap-3"><ArrowUp size={18} /> Ascending</div>
                                        {sortOrder === 'asc' && <div className="w-1.5 h-1.5 rounded-full bg-brand"></div>}
                                    </button>
                                    <button
                                        className={`px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${sortOrder === 'desc' ? 'text-brand bg-brand/5 font-semibold' : 'text-surface-600 hover:bg-surface-50'} `}
                                        onClick={() => { setSortOrder('desc'); setShowSortMenu(false); }}
                                    >
                                        <div className="flex items-center gap-3"><ArrowDown size={18} /> Descending</div>
                                        {sortOrder === 'desc' && <div className="w-1.5 h-1.5 rounded-full bg-brand"></div>}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

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
                        <span className="text-xs font-semibold text-surface-400 animate-pulse tracking-widest uppercase">Loading files...</span>
                    </div>
                ) : sortedFolders.length === 0 && sortedFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white border border-surface-100 rounded-2xl shadow-soft animate-in fade-in duration-500 mx-auto max-w-2xl mt-12">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-brand/10 blur-2xl rounded-full"></div>
                            <Trash2 className="w-16 h-16 text-brand relative z-10" />
                        </div>
                        <h3 className="text-xl font-bold text-surface-900 mb-2">Trash is empty</h3>
                        <p className="text-sm font-medium text-surface-400 mb-8 max-w-[280px] text-center">
                            No files or folders have been moved to the trash yet.
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
                                onDelete={() => setDeleteModal({
                                    isOpen: true,
                                    title: 'Delete Folder Permanently',
                                    message: `Are you sure you want to permanently delete "${folder.name}"?`,
                                    items: [{ type: 'folder', id: folder.id }],
                                    isDeleting: false
                                })}
                                onClick={() => {
                                    if (selectedItems.length > 0) {
                                        toggleSelection('folder', folder.id);
                                    } else {
                                        handleFolderClick(folder.id);
                                    }
                                }}
                                onRefetch={refetch}
                                userId={user!.id}
                            />
                        ))}
                        {sortedFiles.map(file => (
                            <FileItem
                                key={file.id}
                                file={file}
                                viewMode={viewMode}
                                isSelected={selectedItems.some(item => item.id === file.id)}
                                onToggleSelect={() => toggleSelection('file', file.id)}
                                onDelete={() => setDeleteModal({
                                    isOpen: true,
                                    title: 'Delete File Permanently',
                                    message: `Are you sure you want to permanently delete "${file.name}"?`,
                                    items: [{ type: 'file', id: file.id }],
                                    isDeleting: false
                                })}
                                onRefetch={refetch}
                                userId={user!.id}
                                onClick={() => {
                                    if (selectedItems.length > 0) {
                                        toggleSelection('file', file.id);
                                    }
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

            <DeleteConfirmModal
                isOpen={deleteModal.isOpen}
                title={deleteModal.title}
                message={deleteModal.message}
                isLoading={deleteModal.isDeleting}
                onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmDeleteItems}
            />
        </div>
    );
}

function FolderItem({ folder, viewMode, onClick, onRefetch, isSelected, onToggleSelect, onDelete, userId }: { folder: RecordModel, viewMode: 'grid' | 'list', onClick: () => void, onRefetch: () => void, isSelected: boolean, onToggleSelect: () => void, onDelete: () => void, userId: string }) {
    const [showMenu, setShowMenu] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
        setShowMenu(false);
    };

    const handleRestore = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await restoreFromTrash([{ type: 'folder', id: folder.id }], userId);
            onRefetch();
        } catch (err) {
            alert('Restore failed');
        }
    };

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleSelect();
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
                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} className="opacity-0 group-hover:opacity-100" />}
                    </button>
                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-50 text-brand">
                        <FolderIcon size={22} className="fill-brand/20" />
                    </div>
                    <span className="text-sm font-semibold text-surface-900">{folder.name}</span>
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
                                <button className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-3 transition-colors" onClick={handleRestore}>
                                    <FolderInput size={16} /> Restore
                                </button>
                                <div className="h-px bg-surface-100 my-1 mx-2"></div>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors" onClick={handleDelete}>
                                    <Trash2 size={16} /> Delete Permanently
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
                                <button className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-3 transition-colors" onClick={handleRestore}>
                                    <FolderInput size={16} /> Restore
                                </button>
                                <div className="h-px bg-surface-100 my-1 mx-2"></div>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors" onClick={handleDelete}>
                                    <Trash2 size={16} /> Delete Permanently
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="h-full flex flex-col items-center justify-center py-6 group-hover:scale-105 transition-transform duration-300">
                <div className="relative">
                    <FolderIcon className="text-brand fill-brand/10 w-24 h-24 mb-3" />
                </div>
                <span className="text-sm font-bold text-surface-900 text-center truncate w-full px-2 mt-2">{folder.name}</span>
            </div>
        </div>
    );
}

function FileItem({ file, viewMode, onClick, onRefetch, isSelected, onToggleSelect, onDelete, userId }: { file: RecordModel, viewMode: 'grid' | 'list', onClick: () => void, onRefetch: () => void, isSelected: boolean, onToggleSelect: () => void, onDelete: () => void, userId: string }) {
    const [showMenu, setShowMenu] = useState(false);

    const isImage = file.type?.startsWith('image/') || false;
    const isVideo = file.type?.startsWith('video/') || false;
    const fileUrl = pb.files.getURL(file, file.file);
    const thumbnailUrl = isImage ? pb.files.getURL(file, file.file, { thumb: '400x400' }) : (isVideo ? `${fileUrl}#t=0.001` : null);

    const officeExtensions = {
        excel: ['.xls', '.xlsx', '.csv', '.ods', '.xlsm', '.xlt', '.xltm', '.xltx', '.ots'],
        word: ['.doc', '.docx', '.odt', '.rtf', '.docm', '.dot', '.dotm', '.dotx', '.ott', '.txt', '.html', '.htm'],
        powerpoint: ['.ppt', '.pptx', '.odp', '.pptm', '.pot', '.potm', '.potx', '.pps', '.ppsm', '.ppsx', '.otp']
    };

    const isExcel = officeExtensions.excel.some(ext => file.name.toLowerCase().endsWith(ext));
    const isWord = officeExtensions.word.some(ext => file.name.toLowerCase().endsWith(ext));
    const isPPT = officeExtensions.powerpoint.some(ext => file.name.toLowerCase().endsWith(ext));

    const getFileIcon = (size = 22) => {
        if (isImage && thumbnailUrl) return <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />;
        if (isVideo) return <video src={thumbnailUrl || ''} className="w-full h-full object-cover" preload="metadata" muted playsInline />;
        if (isExcel) return <FileSpreadsheet className="text-emerald-500" size={size} />;
        if (isWord) return <FileEdit className="text-blue-500" size={size} />;
        if (isPPT) return <Presentation className="text-orange-500" size={size} />;
        return <FileIcon className="text-surface-400" size={size} />;
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
        setShowMenu(false);
    };

    const handleRestore = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await restoreFromTrash([{ type: 'file', id: file.id }], userId);
            onRefetch();
        } catch (err) {
            alert('Restore failed');
        }
    };

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleSelect();
    };

    if (viewMode === 'list') {
        return (
            <div
                className={`flex items-center justify-between p-3.5 bg-white border ${isSelected ? 'border-brand bg-brand/5 shadow-sm shadow-brand/5' : 'border-surface-100'} rounded-xl hover:border-brand/30 hover:shadow-soft cursor-pointer transition-all group relative ${showMenu ? 'z-30' : 'z-auto'} ${file.is_hidden ? 'opacity-50' : 'opacity-100'}`}
                onClick={onClick}
            >
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleSelect}
                        className={`transition-colors ${isSelected ? 'text-brand' : 'text-surface-300 hover:text-brand outline-none'}`}
                    >
                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} className="opacity-0 group-hover:opacity-100" />}
                    </button>
                    <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-surface-50 overflow-hidden border border-surface-100">
                        {getFileIcon()}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-surface-900 truncate">{file.name}</span>
                        <span className="text-[11px] text-surface-400">{(file.size / 1024 / 1024).toFixed(2)} MB • {file.type?.split('/')[1]?.toUpperCase() || 'FILE'}</span>
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
                                <button className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-3 transition-colors" onClick={handleRestore}>
                                    <FolderInput size={16} /> Restore
                                </button>
                                <div className="h-px bg-surface-100 my-1 mx-2"></div>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors" onClick={handleDelete}>
                                    <Trash2 size={16} /> Delete Permanently
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
            className={`flex flex-col p-3 bg-white border ${isSelected ? 'border-brand bg-brand/5 shadow-md shadow-brand/10' : 'border-surface-100'} rounded-2xl hover:border-brand/30 hover:shadow-premium cursor-pointer transition-all relative group ${showMenu ? 'z-30' : 'z-auto'} ${file.is_hidden ? 'opacity-50' : 'opacity-100'}`}
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
                                <button className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-3 transition-colors" onClick={handleRestore}>
                                    <FolderInput size={16} /> Restore
                                </button>
                                <div className="h-px bg-surface-100 my-1 mx-2"></div>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors" onClick={handleDelete}>
                                    <Trash2 size={16} /> Delete Permanently
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="h-full flex flex-col items-center justify-center pt-2 pb-4 group-hover:scale-105 transition-transform duration-300">
                <div className="w-full aspect-square flex items-center justify-center bg-surface-50 rounded-2xl border border-surface-100 overflow-hidden mb-3 group-hover:shadow-inner transition-all">
                    {getFileIcon(32)}
                </div>
                <span className="text-xs font-bold text-surface-900 text-center truncate w-full px-2">{file.name}</span>
                <span className="text-[10px] text-surface-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
        </div>
    );
}

