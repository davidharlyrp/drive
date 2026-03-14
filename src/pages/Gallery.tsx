import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Image as ImageIcon, CheckSquare, Square, ArrowDownUp, ArrowDown, ArrowUp, X, FolderInput, Trash2, MoreVertical, Edit2 } from 'lucide-react';
import { pb } from '../lib/pb';
import { useAuthStore } from '../store/useAuthStore';
import type { RecordModel } from 'pocketbase';
import { FileViewerModal } from '../components/FileViewerModal';
import { useSettingsStore } from '../store/useSettingsStore';
import { moveToTrash } from '../utils/trashHelper';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { MoveModal } from '../components/MoveModal';
import { InputModal } from '../components/InputModal';
import { useSearchStore } from '../store/useSearchStore';
import { downloadItemsAsZip, downloadSingleFile, type DownloadTask } from '../utils/downloadHelper';
import { DownloadProgressModal } from '../components/DownloadProgressModal';
import { Download } from 'lucide-react';

export default function Gallery() {
    const [files, setFiles] = useState<RecordModel[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuthStore();
    const [previewFile, setPreviewFile] = useState<RecordModel | null>(null);
    const { gridColumns } = useSettingsStore();
    const { searchQuery } = useSearchStore();
    const [searchParams] = useSearchParams();
    const folderId = searchParams.get('folder');
    const [currentFolderName, setCurrentFolderName] = useState<string | null>(null);
    const [apiError, setApiError] = useState<any>(null);
    const [cols, setCols] = useState(gridColumns);

    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [sortType, setSortType] = useState<'name' | 'created' | 'size'>('created');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [itemsToMove, setItemsToMove] = useState<{ type: 'folder' | 'file', id: string, name: string }[] | null>(null);
    const [inputModal, setInputModal] = useState<{ isOpen: boolean; title: string; defaultValue: string; onConfirm: (value: string) => void; }>({ isOpen: false, title: '', defaultValue: '', onConfirm: () => { } });
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; title: string; message: string; items: { type: 'folder' | 'file', id: string }[]; isDeleting: boolean; }>({ isOpen: false, title: '', message: '', items: [], isDeleting: false });
    const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
    const [totalDownloadFiles, setTotalDownloadFiles] = useState(0);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    // Responsive columns that respect the user's max choice but scale down on small screens
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 640) setCols(Math.min(2, gridColumns));
            else if (window.innerWidth < 768) setCols(Math.min(3, gridColumns));
            else if (window.innerWidth < 1024) setCols(Math.min(4, gridColumns));
            else setCols(gridColumns);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [gridColumns]);

    const fetchMedia = async () => {
        if (!user) return;
        setLoading(true);
        setApiError(null);
        try {
            // Fetch everything effortlessly - no API filters that PocketBase can reject
            const res = await pb.collection('files').getFullList({
                sort: '-created',
            });

            // Exactly what we need filtered smoothly on the client
            let mediaFiles = res.filter(f =>
                f.user_id === user.id &&
                f.is_trash === false &&
                (f.type?.startsWith('image/') || f.type?.startsWith('video/'))
            );

            // Filter by folder if folderId is provided
            if (folderId) {
                mediaFiles = mediaFiles.filter(f => f.folder_id === folderId);
                try {
                    const folder = await pb.collection('folders').getOne(folderId);
                    setCurrentFolderName(folder.name);
                } catch (err) {
                    console.error("Failed to fetch folder name", err);
                    setCurrentFolderName(null);
                }
            } else {
                setCurrentFolderName(null);
            }

            setFiles(mediaFiles);
        } catch (err: any) {
            console.error("Failed to fetch gallery media", err);
            setApiError(err.response || err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMedia();
    }, [user, folderId]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSelectedItems([]);
                setActiveMenu(null);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSelectAll = () => {
        if (selectedItems.length === files.length && files.length > 0) {
            setSelectedItems([]);
        } else {
            setSelectedItems(files.map(f => f.id));
        }
    };

    const toggleSelection = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleRenameAction = (file: RecordModel) => {
        setInputModal({
            isOpen: true,
            title: 'Rename File',
            defaultValue: file.name,
            onConfirm: async (newName) => {
                try {
                    await pb.collection('files').update(file.id, { name: newName });
                    fetchMedia();
                } catch (err: any) { alert(err.message); }
            }
        });
    };

    const handleDownload = (file: RecordModel) => {
        downloadSingleFile(file);
    };

    const handleConfirmMove = async (destinationId: string | '') => {
        if (!itemsToMove) return;
        try {
            for (const item of itemsToMove) {
                await pb.collection('files').update(item.id, { folder_id: destinationId });
            }
            setItemsToMove(null);
            setSelectedItems([]);
            fetchMedia();
        } catch (err: any) { alert('Move failed: ' + err.message); }
    };

    const confirmDeleteItems = async () => {
        if (!user) return;
        setDeleteModal(prev => ({ ...prev, isDeleting: true }));
        try {
            await moveToTrash(deleteModal.items as any);
            setSelectedItems([]);
            setDeleteModal(prev => ({ ...prev, isOpen: false }));
            fetchMedia();
        } catch (err: any) {
            alert("Failed to delete: " + err.message);
        } finally {
            setDeleteModal(prev => ({ ...prev, isDeleting: false }));
        }
    };

    const sortedFiles = useMemo(() => {
        let sorted = [...files];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            sorted = sorted.filter(f => f.name.toLowerCase().includes(query));
        }

        if (sortType === 'name') {
            sorted.sort((a, b) => sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
        } else if (sortType === 'created') {
            sorted.sort((a, b) => {
                const dateA = new Date(a.created).getTime();
                const dateB = new Date(b.created).getTime();
                return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            });
        } else if (sortType === 'size') {
            sorted.sort((a, b) => sortOrder === 'asc' ? a.size - b.size : b.size - a.size);
        }
        return sorted;
    }, [files, sortType, sortOrder, searchQuery]);

    // Distribute files safely across columns (Left to Right, Top to Bottom priority)
    const masonryColumns = useMemo(() => {
        const colsArray = Array.from({ length: cols }, () => [] as RecordModel[]);
        sortedFiles.forEach((file, index) => {
            colsArray[index % cols].push(file);
        });
        return colsArray;
    }, [sortedFiles, cols]);

    return (
        <div className="flex flex-col h-full relative">
            <div className="flex flex-row gap-3 sm:items-center justify-between mb-6">
                <div className="flex items-center text-sm text-surface-400">
                    <span className="font-semibold text-brand flex items-center gap-2">
                        <ImageIcon size={18} />
                        {currentFolderName ? (
                            <span className="max-w-[150px]">{currentFolderName}</span>
                        ) : (
                            <span className="max-w-[150px]">All Media</span>
                        )}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {selectedItems.length > 0 ? (
                        <div className="flex items-center py-0.5 gap-2 animate-in fade-in slide-in-from-right-4">
                            <span className="text-xs font-bold text-brand mr-2">{selectedItems.length} selected</span>
                            <button
                                onClick={() => {
                                    const items = selectedItems.map(id => {
                                        const f = files.find(file => file.id === id);
                                        return { type: 'file' as const, id, name: f?.name || '' };
                                    });
                                    setItemsToMove(items);
                                }}
                                className="p-1.5 text-brand hover:bg-brand/20 rounded-md transition-colors"
                            >
                                <FolderInput size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    setDeleteModal({
                                        isOpen: true,
                                        title: 'Move to Trash',
                                        message: `Are you sure you want to move ${selectedItems.length} selected items to the trash?`,
                                        items: selectedItems.map(id => ({ type: 'file' as const, id })),
                                        isDeleting: false
                                    });
                                }}
                                className="p-1.5 text-red-600 hover:bg-red-500/20 rounded-md transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    const items = selectedItems.map(id => {
                                        const f = files.find(file => file.id === id);
                                        return { type: 'file' as const, id, name: f?.name || 'File' };
                                    });
                                    downloadItemsAsZip(items, 'gallery_download.zip', (total, tasks) => {
                                        setTotalDownloadFiles(total);
                                        setDownloadTasks(tasks);
                                    });
                                }}
                                className="p-1.5 text-brand hover:bg-brand/20 rounded-md transition-colors"
                                title="Download as ZIP"
                            >
                                <Download size={16} />
                            </button>
                            <div className="w-px h-4 bg-brand/20 mx-1"></div>
                            <button onClick={() => setSelectedItems([])} className="p-1 text-surface-400 hover:text-surface-700 transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={handleSelectAll}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-surface-600 hover:bg-surface-100 rounded-lg transition-colors border border-surface-200 shadow-sm"
                            >
                                {files.length > 0 && selectedItems.length === files.length ? <CheckSquare size={16} className="text-brand" /> : <Square size={16} />}
                                <span className="hidden sm:inline">Select All</span>
                            </button>
                            <div className="relative">
                                <button
                                    onClick={() => setShowSortMenu(!showSortMenu)}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-surface-700 bg-white border border-surface-200 rounded-xl shadow-sm transition-all"
                                >
                                    <ArrowDownUp size={14} className="text-surface-500" />
                                    <span className="hidden sm:inline capitalize">Sort by {sortType}</span>
                                </button>
                                {showSortMenu && (
                                    <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-premium border border-surface-100 py-1.5 z-50">
                                        {(['name', 'created', 'size'] as const).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => { setSortType(type); setShowSortMenu(false); }}
                                                className="w-full text-left px-4 py-2 text-[13px] font-medium text-surface-700 hover:bg-surface-50 flex justify-between"
                                            >
                                                <span className="capitalize">{type}</span>
                                                {sortType === type && <CheckSquare size={14} className="text-brand" />}
                                            </button>
                                        ))}
                                        <div className="h-px bg-surface-100 my-1"></div>
                                        <button
                                            onClick={() => { setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); setShowSortMenu(false); }}
                                            className="w-full text-left px-4 py-2 text-[13px] font-medium text-surface-700 hover:bg-surface-50 flex justify-between"
                                        >
                                            <span>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
                                            {sortOrder === 'asc' ? <ArrowUp size={14} className="text-surface-500" /> : <ArrowDown size={14} className="text-surface-500" />}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-1 custom-scrollbar pb-10">
                {apiError ? (
                    <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-200 m-4">
                        <h3 className="font-bold mb-2">Failed to load from Database (400)</h3>
                        <pre className="text-xs overflow-auto bg-white p-4 rounded-xl border border-red-100">{JSON.stringify(apiError, null, 2)}</pre>
                    </div>
                ) : loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="animate-spin w-10 h-10 border-4 border-brand border-t-transparent rounded-full"></div>
                        <span className="text-xs font-bold text-surface-400 animate-pulse tracking-widest uppercase">Loading media...</span>
                    </div>
                ) : files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white border border-surface-100 rounded-2xl shadow-soft animate-in fade-in duration-500 mx-auto max-w-2xl mt-12">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-brand/10 blur-2xl rounded-full"></div>
                            <ImageIcon className="w-16 h-16 text-brand relative z-10" />
                        </div>
                        <h3 className="text-xl font-bold text-surface-900 mb-2">No media found</h3>
                        <p className="text-sm font-medium text-surface-400 mb-8 max-w-[280px] text-center">
                            Upload photos or videos to see them directly in your gallery.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-row gap-3 sm:gap-4 w-full">
                        {masonryColumns.map((column, colIndex) => (
                            <div key={colIndex} className="flex flex-col gap-3 sm:gap-4 flex-1 min-w-0">
                                {column.map(file => {
                                    const isImage = file.type?.startsWith('image/') || false;
                                    const isVideo = file.type?.startsWith('video/') || false;
                                    const fileUrl = pb.files.getURL(file, file.file);

                                    // Make sure we preserve aspect ratio, asking Pocketbase for width-only resize (e.g. 800 width, auto height)
                                    const thumbnailUrl = isImage ? pb.files.getURL(file, file.file, { thumb: '800x0' }) : (isVideo ? `${fileUrl}#t=0.001` : null);

                                    // Mimic the mockups tags using file extensions
                                    const extension = file.name.split('.').pop()?.toUpperCase() || 'FILE';

                                    return (
                                        <div
                                            key={file.id}
                                            className={`relative group rounded-2xl overflow-hidden bg-surface-50 border ${selectedItems.includes(file.id) ? 'border-brand shadow-md shadow-brand/10' : 'border-surface-100 shadow-sm hover:shadow-premium hover:border-brand/30'} transition-all w-full`}
                                        >
                                            <div className="absolute inset-0 z-10 cursor-pointer" onClick={() => setPreviewFile(file)}></div>

                                            {/* Top-left: Selection Checkbox on Hover or Selected */}
                                            <button
                                                onClick={(e) => toggleSelection(e, file.id)}
                                                className={`absolute top-3 left-3 z-30 p-1.5 rounded-lg flex items-center justify-center backdrop-blur-md transition-all ${selectedItems.includes(file.id) ? 'bg-brand/90 text-white opacity-100' : 'bg-black/40 text-white/70 opacity-100 md:opacity-0 group-hover:opacity-100 hover:bg-black/60 hover:text-white'}`}
                                            >
                                                {selectedItems.includes(file.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                                            </button>

                                            {/* Top-right: Category + Context Menu */}
                                            <div className={`absolute top-3 right-3 z-30 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${activeMenu === file.id ? 'opacity-100' : ''}`}>
                                                <div className="bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white border border-white/20 uppercase tracking-wide">
                                                    {extension}
                                                </div>
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === file.id ? null : file.id); }}
                                                        className="p-1 rounded-lg bg-black/40 backdrop-blur-md text-white/80 hover:bg-black/60 hover:text-white border border-white/20 transition-all"
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    {activeMenu === file.id && (
                                                        <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-premium border border-surface-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 flex flex-col">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveMenu(null);
                                                                    handleRenameAction(file);
                                                                }}
                                                                className="px-3 py-2 text-[13px] font-semibold text-surface-700 hover:bg-surface-50 hover:text-brand flex items-center gap-2"
                                                            >
                                                                <Edit2 size={14} className="opacity-70" /> Rename
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveMenu(null);
                                                                    setItemsToMove([{ type: 'file', id: file.id, name: file.name }]);
                                                                }}
                                                                className="px-3 py-2 text-[13px] font-semibold text-surface-700 hover:bg-surface-50 hover:text-brand flex items-center gap-2"
                                                            >
                                                                <FolderInput size={14} className="opacity-70" /> Move
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveMenu(null);
                                                                    handleDownload(file);
                                                                }}
                                                                className="px-3 py-2 text-[13px] font-semibold text-surface-700 hover:bg-surface-50 hover:text-brand flex items-center gap-2"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download
                                                            </button>
                                                            <div className="h-px bg-surface-100 my-1"></div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveMenu(null);
                                                                    setDeleteModal({
                                                                        isOpen: true,
                                                                        title: 'Move to Trash',
                                                                        message: `Are you sure you want to move "${file.name}" to the trash?`,
                                                                        items: [{ type: 'file', id: file.id }],
                                                                        isDeleting: false
                                                                    });
                                                                }}
                                                                className="px-3 py-2 text-[13px] font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                            >
                                                                <Trash2 size={14} className="opacity-70" /> Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {isImage && thumbnailUrl ? (
                                                <img src={thumbnailUrl} alt={file.name} className="w-full h-auto block object-cover group-hover:scale-105 transition-transform duration-500" />
                                            ) : isVideo ? (
                                                <div className="relative w-full h-full">
                                                    <video src={thumbnailUrl || ''} className="w-full h-auto block object-cover group-hover:scale-105 transition-transform duration-500" preload="metadata" muted playsInline />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                                        <div className="w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                                                            <div className="w-0 h-0 border-t-4 border-t-transparent border-l-6 border-l-white border-b-4 border-b-transparent ml-1"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {previewFile && (
                <FileViewerModal
                    file={previewFile}
                    files={sortedFiles}
                    onClose={() => setPreviewFile(null)}
                    onRefetch={fetchMedia}
                    onRename={handleRenameAction}
                    onMove={(file) => setItemsToMove([{ type: 'file', id: file.id, name: file.name }])}
                    onDownload={handleDownload}
                    onDelete={(file) => setDeleteModal({
                        isOpen: true,
                        title: 'Move to Trash',
                        message: `Are you sure you want to move "${file.name}" to the trash?`,
                        items: [{ type: 'file', id: file.id }],
                        isDeleting: false
                    })}
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

