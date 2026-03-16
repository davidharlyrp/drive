import { useState, useRef, useEffect, useMemo } from 'react';
import { Trash2, Edit2, MoreVertical, LayoutGrid, List, CheckSquare, Square, HardDrive, Plus, Upload, FolderPlus, ArrowDownUp, ArrowDown, ArrowUp, Type, Calendar, Database, FileText, Download, FolderInput, Star, File as FileIcon, Folder as FolderIcon, FileEdit, FileSpreadsheet, Presentation } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStorage } from '../hooks/useStorage';
import type { RecordModel } from 'pocketbase';
import { pb } from '../lib/pb';
import { useAuthStore } from '../store/useAuthStore';
import { FileViewerModal } from '../components/FileViewerModal';
import { UploadProgressModal, type UploadTask } from '../components/UploadProgressModal';
import { MoveModal } from '../components/MoveModal';
import { InputModal } from '../components/InputModal';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSearchStore } from '../store/useSearchStore';
import { moveToTrash } from '../utils/trashHelper';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { downloadItemsAsZip, downloadSingleFile, type DownloadTask } from '../utils/downloadHelper';
import { DownloadProgressModal } from '../components/DownloadProgressModal';
import { toggleStarred } from '../utils/starredHelper';
import { OFFICE_TEMPLATES, base64ToBlob } from '../utils/officeTemplates';
import { toggleHidden } from '../utils/hideHelper';
import { Eye, EyeOff } from 'lucide-react';

export default function FileExplorer({ isSharedView = false, isStarredView = false }: { isSharedView?: boolean, isStarredView?: boolean }) {
    const { folderId } = useParams();
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const { showHidden } = useSettingsStore();
    const { folders, files, breadcrumbs, loading, loadingMore, hasMore, loadMore, totalFiles, refetch } = useStorage(folderId || 'root', false, isStarredView, isSharedView, showHidden);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { user, token, updateStorage } = useAuthStore();
    const { gridColumns } = useSettingsStore();
    const { searchQuery } = useSearchStore();
    const [previewFile, setPreviewFile] = useState<RecordModel | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedItems, setSelectedItems] = useState<{ type: 'folder' | 'file', id: string }[]>([]);

    const gridColumnClass = {
        2: 'grid-cols-2',
        3: 'grid-cols-2 sm:grid-cols-3',
        4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
        5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
        6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
        8: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
    }[gridColumns] || 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';
    const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
    const [itemsToMove, setItemsToMove] = useState<{ type: 'folder' | 'file', id: string, name: string }[] | null>(null);
    const [sortType, setSortType] = useState<'name' | 'date' | 'size'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
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

    // Clear selection on folder change
    useEffect(() => {
        setSelectedItems([]);
    }, [folderId]);

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

    const handleFolderClick = (id: string) => {
        navigate(isSharedView ? `/shared/${id}` : (isStarredView ? `/starred/${id}` : `/files/${id}`));
    };

    const handleCreateFolder = () => {
        setInputModal({
            isOpen: true,
            title: 'New Folder',
            defaultValue: '',
            placeholder: 'Enter folder name',
            onConfirm: async (name) => {
                if (!user) return;
                try {
                    const parentFolder = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;
                    const isShared = parentFolder?.is_shared || false;
                    let sharedWith = Array.isArray(parentFolder?.shared_with) ? [...parentFolder.shared_with] : [];
                    if (isShared) {
                        // Inherit existing shared_with, excluding current user to avoid self-sharing
                        const currentUser = user.id;
                        sharedWith = sharedWith.filter((uid: string) => uid !== currentUser);

                        // If parent folder is owned by someone else, ensure they are in shared_with
                        if (parentFolder?.user_id && parentFolder.user_id !== user.id) {
                            if (!sharedWith.includes(parentFolder.user_id)) {
                                sharedWith.push(parentFolder.user_id);
                            }
                        }
                    }

                    await pb.collection('folders').create({
                        name,
                        parent: folderId === 'root' ? '' : folderId,
                        user_id: user.id,
                        is_shared: isShared,
                        shared_with: sharedWith
                    });
                    refetch();
                } catch (e: any) { alert(e.message); }
            }
        });
    };

    const xhrUpload = (formData: FormData, taskId: string): Promise<any> => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const url = `${pb.baseUrl}/api/collections/files/records`;

            xhr.open('POST', url);

            if (token) {
                xhr.setRequestHeader('Authorization', token);
            }

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = (event.loaded / event.total) * 100;
                    setUploadTasks(prev => prev.map(t =>
                        t.id === taskId ? { ...t, progress: percent } : t
                    ));
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.response));
                } else {
                    reject(new Error(xhr.statusText || 'Upload failed'));
                }
            };

            xhr.onerror = () => reject(new Error('Network error'));
            xhr.send(formData);
        });
    };

    const uploadFiles = async (fileList: FileList | File[]) => {
        if (!user) return;
        const filesToUpload = Array.from(fileList);

        // Initialize tasks
        const newTasks: UploadTask[] = filesToUpload.map(file => ({
            id: Math.random().toString(36).substring(7),
            name: file.name,
            size: file.size,
            progress: 0,
            status: 'uploading'
        }));

        setUploadTasks(prev => [...prev, ...newTasks]);

        try {
            // Upload files
            for (let i = 0; i < filesToUpload.length; i++) {
                const file = filesToUpload[i];
                const taskId = newTasks[i].id;

                const formData = new FormData();
                formData.append('file', file);
                formData.append('name', file.name);
                formData.append('size', file.size.toString());
                formData.append('type', file.type || 'application/octet-stream');
                formData.append('user_id', user.id);
                if (folderId !== 'root' && folderId) formData.append('folder_id', folderId);

                // Inheritance
                const parentFolder = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;
                if (parentFolder?.is_shared) {
                    formData.append('is_shared', 'true');
                    let sharedWith = Array.isArray(parentFolder.shared_with) ? [...parentFolder.shared_with] : [];

                    // Filter out current user to avoid redundant self-sharing
                    sharedWith = sharedWith.filter((uid: string) => uid !== user.id);

                    // Ensure the owner of the parent folder is in shared_with
                    if (parentFolder.user_id && parentFolder.user_id !== user.id) {
                        if (!sharedWith.includes(parentFolder.user_id)) {
                            sharedWith.push(parentFolder.user_id);
                        }
                    }

                    sharedWith.forEach((id: string) => formData.append('shared_with', id));
                }

                try {
                    await xhrUpload(formData, taskId);

                    setUploadTasks(prev => prev.map(t =>
                        t.id === taskId ? { ...t, status: 'completed', progress: 100 } : t
                    ));
                } catch (err: any) {
                    setUploadTasks(prev => prev.map(t =>
                        t.id === taskId ? { ...t, status: 'error', error: err.message } : t
                    ));
                }
            }
            refetch();
            updateStorage();
        } catch (err: any) {
            console.error('Batch upload error:', err);
            refetch();
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) uploadFiles(e.target.files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (isSharedView || isStarredView) return;
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        if (isSharedView || isStarredView) return;
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            uploadFiles(e.dataTransfer.files);
        }
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
            title: 'Move to Trash',
            message: `Are you sure you want to move ${selectedItems.length} selected items to the trash?`,
            items: selectedItems,
            isDeleting: false
        });
    };

    const confirmDeleteItems = async () => {
        setDeleteModal(prev => ({ ...prev, isDeleting: true }));
        try {
            await moveToTrash(deleteModal.items, user!.id);
            setSelectedItems([]);
            refetch();
            updateStorage();
            setDeleteModal(prev => ({ ...prev, isOpen: false, isDeleting: false }));
        } catch (err: any) {
            alert('Move to trash failed: ' + err.message);
            setDeleteModal(prev => ({ ...prev, isDeleting: false }));
            refetch();
        }
    };

    const handleRename = async (type: 'folder' | 'file', id: string, currentName: string) => {
        setInputModal({
            isOpen: true,
            title: `Rename ${type === 'folder' ? 'Folder' : 'File'} `,
            defaultValue: currentName,
            placeholder: 'Enter new name',
            onConfirm: async (newName) => {
                try {
                    const collection = type === 'folder' ? 'folders' : 'files';
                    await pb.collection(collection).update(id, { name: newName });
                    refetch();
                } catch (err: any) {
                    alert('Rename failed: ' + err.message);
                }
            }
        });
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



    const handleCreateTextFile = () => {
        setInputModal({
            isOpen: true,
            title: 'Create Text File',
            defaultValue: 'New File.txt',
            placeholder: 'Enter file name (.txt)',
            onConfirm: async (name) => {
                try {
                    const finalName = name.endsWith('.txt') ? name : `${name}.txt`;
                    const blob = new Blob([''], { type: 'text/plain' });
                    const formData = new FormData();
                    formData.append('file', blob, finalName);
                    formData.append('name', finalName);
                    formData.append('user_id', user!.id);
                    if (folderId && folderId !== 'root') {
                        formData.append('folder_id', folderId);
                    }
                    if (isStarredView) {
                        formData.append('is_starred', 'true');
                    }

                    // Inheritance
                    const parentFolder = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;
                    if (parentFolder?.is_shared) {
                        formData.append('is_shared', 'true');
                        let sharedWith = Array.isArray(parentFolder.shared_with) ? [...parentFolder.shared_with] : [];

                        // Filter out current user to avoid redundant self-sharing
                        sharedWith = sharedWith.filter((uid: string) => uid !== user!.id);

                        // Ensure the owner of the parent folder is in shared_with
                        if (parentFolder.user_id && parentFolder.user_id !== user!.id) {
                            if (!sharedWith.includes(parentFolder.user_id)) {
                                sharedWith.push(parentFolder.user_id);
                            }
                        }

                        sharedWith.forEach((id: string) => formData.append('shared_with', id));
                    }

                    await pb.collection('files').create(formData);
                    refetch();
                    updateStorage();
                } catch (err) {
                    alert('Failed to create text file.');
                }
            }
        });
    };

    const handleCreateOfficeFile = (type: 'docx' | 'xlsx' | 'pptx') => {
        const typeLabels = {
            docx: { label: 'Document', ext: '.docx', icon: <FileEdit size={16} />, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
            xlsx: { label: 'Spreadsheet', ext: '.xlsx', icon: <FileSpreadsheet size={16} />, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
            pptx: { label: 'Presentation', ext: '.pptx', icon: <Presentation size={16} />, mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }
        };
        const info = typeLabels[type];

        setInputModal({
            isOpen: true,
            title: `Create New ${info.label}`,
            defaultValue: `New ${info.label}${info.ext}`,
            placeholder: `Enter file name (${info.ext})`,
            onConfirm: async (name) => {
                if (!user) return;
                try {
                    const finalName = name.endsWith(info.ext) ? name : `${name}${info.ext}`;
                    const blob = base64ToBlob(OFFICE_TEMPLATES[type], info.mime);
                    const formData = new FormData();
                    formData.append('file', blob, finalName);
                    formData.append('name', finalName);
                    formData.append('user_id', user.id);
                    formData.append('size', blob.size.toString());
                    formData.append('type', info.mime);
                    if (folderId && folderId !== 'root') {
                        formData.append('folder_id', folderId);
                    }
                    if (isStarredView) {
                        formData.append('is_starred', 'true');
                    }

                    // Inheritance
                    const parentFolder = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;
                    if (parentFolder?.is_shared) {
                        formData.append('is_shared', 'true');
                        let sharedWith = Array.isArray(parentFolder.shared_with) ? [...parentFolder.shared_with] : [];
                        sharedWith = sharedWith.filter((uid: string) => uid !== user.id);
                        if (parentFolder.user_id && parentFolder.user_id !== user.id) {
                            if (!sharedWith.includes(parentFolder.user_id)) {
                                sharedWith.push(parentFolder.user_id);
                            }
                        }
                        sharedWith.forEach((id: string) => formData.append('shared_with', id));
                    }

                    const record = await pb.collection('files').create(formData);
                    refetch();
                    updateStorage();

                    // Open in editor
                    window.open(`/editor/${record.id}`, '_blank');
                } catch (err) {
                    alert(`Failed to create ${info.label}.`);
                }
            }
        });
    };

    return (
        <div
            className="flex flex-col h-full relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag Overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-brand/5 backdrop-blur-sm border-2 border-dashed border-brand/30 flex items-center justify-center rounded-xl pointer-events-none transition-all">
                    <div className="bg-white p-8 rounded-2xl shadow-premium flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
                        <Upload size={48} className="text-brand animate-bounce" />
                        <span className="text-xl font-bold text-surface-900">Drop files to upload</span>
                        <span className="text-sm text-surface-500 italic">instantly to this folder</span>
                    </div>
                </div>
            )}

            {/* Breadcrumbs */}
            <div className="flex items-center text-sm mb-2 text-surface-400 overflow-x-auto whitespace-nowrap pb-2 scrollbar-none">
                <span
                    className="hover:text-brand cursor-pointer transition-colors font-medium flex items-center gap-1.5"
                    onClick={() => navigate(isSharedView ? '/shared/root' : (isStarredView ? '/starred/root' : '/files/root'))}
                >
                    {isStarredView ? <Star size={16} className="text-amber-500 fill-amber-500" /> : <HardDrive size={16} />}
                    {isStarredView ? 'Starred' : 'My Files'}
                </span>
                {/* Breadcrumbs */}
                {breadcrumbs.length > 2 ? (
                    <>
                        <div className="flex items-center">
                            <span className="mx-3 text-surface-300">/</span>
                            <span className="text-surface-300 font-medium px-1">...</span>
                        </div>
                        <div className="flex items-center">
                            <span className="mx-3 text-surface-300">/</span>
                            <span
                                className="hover:text-brand cursor-pointer transition-colors font-medium max-w-[120px] truncate"
                                onClick={() => navigate(isSharedView ? `/shared/${breadcrumbs[breadcrumbs.length - 2].id}` : (isStarredView ? `/starred/${breadcrumbs[breadcrumbs.length - 2].id}` : `/files/${breadcrumbs[breadcrumbs.length - 2].id}`))}
                                title={breadcrumbs[breadcrumbs.length - 2].name}
                            >
                                {breadcrumbs[breadcrumbs.length - 2].name}
                            </span>
                        </div>
                        <div className="flex items-center">
                            <span className="mx-3 text-surface-300">/</span>
                            <span
                                className="text-brand font-semibold cursor-pointer transition-colors max-w-[150px] truncate"
                                onClick={() => navigate(isSharedView ? `/shared/${breadcrumbs[breadcrumbs.length - 1].id}` : (isStarredView ? `/starred/${breadcrumbs[breadcrumbs.length - 1].id}` : `/files/${breadcrumbs[breadcrumbs.length - 1].id}`))}
                                title={breadcrumbs[breadcrumbs.length - 1].name}
                            >
                                {breadcrumbs[breadcrumbs.length - 1].name}
                            </span>
                        </div>
                    </>
                ) : (
                    breadcrumbs.map((crumb) => (
                        <div key={crumb.id} className="flex items-center">
                            <span className="mx-3 text-surface-300">/</span>
                            <span
                                className={`hover:text-brand cursor-pointer transition-colors max-w-[150px] truncate ${crumb.id === folderId ? 'text-brand font-semibold' : 'font-medium'}`}
                                onClick={() => navigate(isSharedView ? `/shared/${crumb.id}` : (isStarredView ? `/starred/${crumb.id}` : `/files/${crumb.id}`))}
                                title={crumb.name}
                            >
                                {crumb.name}
                            </span>
                        </div>
                    ))
                )}
                {loading && breadcrumbs.length === 0 && folderId !== 'root' && (
                    <span className="mx-3 text-surface-300 animate-pulse">/ ...</span>
                )}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between md:gap-4 gap-2 mb-2 md:mb-8 pb-2 md:pb-6 border-b border-surface-200">
                <div className="flex items-center md:gap-3 gap-2">
                    {!(isSharedView || isStarredView) && (
                        <div className="relative">
                            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                            <button className="btn-primary" onClick={() => setShowAddMenu(!showAddMenu)}>
                                <Plus size={18} />
                            </button>
                            {showAddMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)}></div>
                                    <div className="absolute left-0 mt-2 w-44 bg-white border border-surface-100 rounded-2xl shadow-premium z-20 py-2 animate-in fade-in zoom-in-95 duration-200">
                                        <button
                                            className="w-full text-left px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors"
                                            onClick={() => {
                                                setShowAddMenu(false);
                                                fileInputRef.current?.click();
                                            }}
                                        >
                                            <Upload size={16} className="text-surface-400" /> Upload File
                                        </button>
                                        <button
                                            className="w-full text-left px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors"
                                            onClick={() => {
                                                setShowAddMenu(false);
                                                handleCreateTextFile();
                                            }}
                                        >
                                            <FileText size={16} className="text-surface-400" /> Create TXT File
                                        </button>
                                        <div className="h-px bg-surface-100 my-1 mx-2"></div>
                                        <button
                                            className="w-full text-left px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors"
                                            onClick={() => { setShowAddMenu(false); handleCreateOfficeFile('docx'); }}
                                        >
                                            <FileEdit size={16} className="text-blue-500" /> New .docx
                                        </button>
                                        <button
                                            className="w-full text-left px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors"
                                            onClick={() => { setShowAddMenu(false); handleCreateOfficeFile('xlsx'); }}
                                        >
                                            <FileSpreadsheet size={16} className="text-emerald-500" /> New .xlsx
                                        </button>
                                        <button
                                            className="w-full text-left px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors"
                                            onClick={() => { setShowAddMenu(false); handleCreateOfficeFile('pptx'); }}
                                        >
                                            <Presentation size={16} className="text-orange-500" /> New .pptx
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    {!(isSharedView || isStarredView) && (
                        <button className="btn-secondary" onClick={handleCreateFolder}>
                            <FolderPlus size={18} />
                        </button>
                    )}
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
                            <span className="hidden md:block">{selectedItems.length === (sortedFolders.length + sortedFiles.length) && (sortedFolders.length + sortedFiles.length) > 0 ? 'Deselect All' : 'Select All'}</span>
                        </button>
                    )}
                    {selectedItems.length > 0 && (
                        <div className="flex items-center gap-2 animate-in slide-in-from-left-4 fade-in duration-300">
                            <div className="w-px h-6 bg-surface-200 mx-1"></div>
                            {!(isSharedView || isStarredView) && (
                                <button
                                    className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-surface-50 text-surface-700 border border-surface-200 rounded-xl transition-all text-sm font-medium shadow-sm active:scale-95"
                                    onClick={() => {
                                        const items = selectedItems.map(item => {
                                            const folder = sortedFolders.find(f => f.id === item.id);
                                            const file = sortedFiles.find(f => f.id === item.id);
                                            return { type: item.type, id: item.id, name: folder?.name || file?.name || 'Unknown' };
                                        });
                                        setItemsToMove(items);
                                    }}
                                >
                                    <FolderInput size={18} className="text-brand" />
                                    <span className="hidden md:block">({selectedItems.length})</span>
                                </button>
                            )}
                            <button
                                className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-xl transition-all text-sm font-medium shadow-sm shadow-red-100/50 active:scale-95"
                                onClick={handleBatchDelete}
                            >
                                <Trash2 size={18} />
                                <span className="hidden md:block">({selectedItems.length})</span>
                            </button>
                            <button
                                className="flex items-center gap-2 px-4 py-2 bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 rounded-xl transition-all text-sm font-medium shadow-sm active:scale-95"
                                onClick={() => {
                                    const items = selectedItems.map(item => {
                                        const folder = sortedFolders.find(f => f.id === item.id);
                                        const file = sortedFiles.find(f => f.id === item.id);
                                        return { type: item.type, id: item.id, name: folder?.name || file?.name || 'Unknown' };
                                    });
                                    downloadItemsAsZip(items, 'selected_items.zip', (total, tasks) => {
                                        setTotalDownloadFiles(total);
                                        setDownloadTasks(tasks);
                                    });
                                }}
                            >
                                <Download size={18} />
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
                        <span className="text-xs font-normal text-surface-400 animate-pulse tracking-widest">Loading files...</span>
                    </div>
                ) : sortedFolders.length === 0 && sortedFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white border border-surface-100 rounded-2xl shadow-soft animate-in fade-in duration-500 mx-auto max-w-2xl mt-12">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-brand/10 blur-2xl rounded-full"></div>
                            <Database className="w-16 h-16 text-brand relative z-10" />
                        </div>
                        <h3 className="text-xl font-bold text-surface-900 mb-2">No files found</h3>
                        <p className="text-sm font-medium text-surface-400 mb-8 max-w-[280px] text-center">
                            This folder is currently empty. Start by uploading some files or dragging them here.
                        </p>
                    </div>
                ) : (
                    <div className={viewMode === 'grid' ? `grid ${gridColumnClass} gap-5 pb-32` : "flex flex-col gap-2 pb-32"}>
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
                                onDownloadZip={() => downloadItemsAsZip([{ type: 'folder', id: folder.id, name: folder.name }], `${folder.name}.zip`, (total, tasks) => {
                                    setTotalDownloadFiles(total);
                                    setDownloadTasks(tasks);
                                })}
                                onClick={() => {
                                    if (selectedItems.length > 0) {
                                        toggleSelection('folder', folder.id);
                                    } else {
                                        handleFolderClick(folder.id);
                                    }
                                }}
                                onToggleStar={async () => {
                                    await toggleStarred([{ type: 'folder', id: folder.id }], !folder.is_starred, user!.id);
                                    refetch(true);
                                }}
                                user={user}
                                refetch={() => refetch(true)}
                                isStarredView={isStarredView}
                                canMove={!isSharedView && !isStarredView}
                                isSharedView={isSharedView}
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
                                onToggleStar={async () => {
                                    await toggleStarred([{ type: 'file', id: file.id }], !file.is_starred, user!.id);
                                    refetch(true);
                                }}
                                user={user}
                                refetch={() => refetch(true)}
                                isStarredView={isStarredView}
                                canMove={!isSharedView && !isStarredView}
                                isSharedView={isSharedView}
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
                    onMove={!(isSharedView && (folderId === 'root' || !folderId)) ? (file) => setItemsToMove([{ type: 'file', id: file.id, name: file.name }]) : undefined}
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
                    isSharedView={isSharedView}
                />
            )}

            <UploadProgressModal
                tasks={uploadTasks}
                onClose={() => setUploadTasks([])}
            />

            {itemsToMove && (
                <MoveModal
                    itemsToMove={itemsToMove}
                    onClose={() => setItemsToMove(null)}
                    onConfirm={handleConfirmMove}
                    isSharedView={isSharedView}
                    currentFolderId={folderId}
                />
            )}

            <InputModal
                isOpen={inputModal.isOpen}
                title={inputModal.title}
                defaultValue={inputModal.defaultValue}
                placeholder={inputModal.placeholder}
                onClose={() => setInputModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={inputModal.onConfirm}
            />

            <DeleteConfirmModal
                isOpen={deleteModal.isOpen}
                title={deleteModal.title}
                message={deleteModal.message}
                isLoading={deleteModal.isDeleting}
                onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmDeleteItems}
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

function FolderItem({ folder, viewMode, onClick, isSelected, onToggleSelect, onRename, onMove, onDelete, onDownloadZip, onToggleStar, refetch, user, isStarredView = false, isSharedView = false, canMove = true }: { folder: RecordModel, viewMode: 'grid' | 'list', onClick: () => void, isSelected: boolean, onToggleSelect: () => void, onRename: (id: string, name: string) => void, onMove: () => void, onDelete: () => void, onDownloadZip: () => void, onToggleStar: () => void, refetch: () => void, user: any, isStarredView?: boolean, isSharedView?: boolean, canMove?: boolean }) {
    const [showMenu, setShowMenu] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
        setShowMenu(false);
    };

    const handleRenameClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onRename(folder.id, folder.name);
        setShowMenu(false);
    };

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleSelect();
    };

    if (viewMode === 'list') {
        return (
            <div
                className={`flex items-center justify-between p-3.5 bg-white border ${isSelected ? 'border-brand bg-brand/5 shadow-sm shadow-brand/5' : 'border-surface-100'} rounded-xl hover:border-brand/30 hover:shadow-soft cursor-pointer transition-all group relative ${showMenu ? 'z-30' : 'z-auto'} ${folder.is_hidden ? 'opacity-50' : 'opacity-100'}`}
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
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-semibold text-surface-900 truncate">{folder.name}</span>
                        {folder.is_starred && <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />}
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
                                {!isSharedView && (
                                    <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={(e) => { e.stopPropagation(); onToggleStar(); setShowMenu(false); }}>
                                        <Star size={16} className={folder.is_starred ? "text-amber-500 fill-amber-500" : "text-surface-400"} /> {folder.is_starred ? 'Unstar' : 'Star'}
                                    </button>
                                )}
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleRenameClick}>
                                    <Edit2 size={16} className="text-surface-400" /> Rename
                                </button>
                                {canMove && !isSharedView && !isStarredView && (
                                    <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={(e) => { e.stopPropagation(); onMove(); setShowMenu(false); }}>
                                        <FolderInput size={16} className="text-surface-400" /> Move
                                    </button>
                                )}

                                {!isSharedView && (
                                    <button
                                        className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            await toggleHidden([{ type: 'folder', id: folder.id }], !folder.is_hidden, user!.id);
                                            refetch();
                                            setShowMenu(false);
                                        }}
                                    >
                                        {folder.is_hidden ? (
                                            <><Eye size={16} className="text-surface-400" /> Unhide</>
                                        ) : (
                                            <><EyeOff size={16} className="text-surface-400" /> Hide</>
                                        )}
                                    </button>
                                )}
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={(e) => { e.stopPropagation(); onDownloadZip(); setShowMenu(false); }}>
                                    <Download size={16} className="text-surface-400" /> Download ZIP
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
            className={`flex flex-col p-4 bg-white border ${isSelected ? 'border-brand bg-brand/5 shadow-md shadow-brand/10' : 'border-surface-100'} rounded-2xl hover:border-brand/30 hover:shadow-premium cursor-pointer transition-all relative group ${showMenu ? 'z-30' : 'z-auto'} ${folder.is_hidden ? 'opacity-50' : 'opacity-100'}`}
            onClick={onClick}
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSelect}
                        className={`transition-colors h-6 ${isSelected ? 'text-brand' : 'text-surface-300 hover:text-brand outline-none'}`}
                    >
                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} className="group-hover:opacity-100" />}
                    </button>
                    {folder.is_starred &&
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
                            className="cursor-pointer"
                        >
                            <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />
                        </button>
                    }
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
                            <div className="absolute right-0 top-10 z-50 w-48 bg-white border border-surface-100 rounded-2xl shadow-premium py-2 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                {!isSharedView && (
                                    <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={(e) => { e.stopPropagation(); onToggleStar(); setShowMenu(false); }}>
                                        <Star size={16} className={folder.is_starred ? "text-amber-500 fill-amber-500" : "text-surface-400"} /> {folder.is_starred ? 'Unstar' : 'Star'}
                                    </button>
                                )}
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleRenameClick}>
                                    <Edit2 size={16} className="text-surface-400" /> Rename
                                </button>
                                {canMove && !isSharedView && !isStarredView && (
                                    <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={(e) => { e.stopPropagation(); onMove(); setShowMenu(false); }}>
                                        <FolderInput size={16} className="text-surface-400" /> Move
                                    </button>
                                )}

                                {!isSharedView && (
                                    <button
                                        className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            await toggleHidden([{ type: 'folder', id: folder.id }], !folder.is_hidden, user!.id);
                                            refetch();
                                            setShowMenu(false);
                                        }}
                                    >
                                        {folder.is_hidden ? (
                                            <><Eye size={16} className="text-surface-400" /> Unhide</>
                                        ) : (
                                            <><EyeOff size={16} className="text-surface-400" /> Hide</>
                                        )}
                                    </button>
                                )}
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={(e) => { e.stopPropagation(); onDownloadZip(); setShowMenu(false); }}>
                                    <Download size={16} className="text-surface-400" /> Download ZIP
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

            <div className="h-full flex flex-col items-center justify-center py-6 group-hover:scale-105 transition-transform duration-300">
                <div className="relative">
                    <FolderIcon className="text-brand fill-brand/10 w-24 h-24 mb-3" />
                </div>
                <div className="flex items-center justify-center gap-1.5 w-full px-2 mt-2">
                    <span className="text-sm font-semibold text-surface-900 truncate">{folder.name}</span>
                </div>
            </div>
        </div>
    );
}

function FileItem({ file, viewMode, onClick, isSelected, onToggleSelect, onRename, onMove, onDelete, onToggleStar, refetch, user, isStarredView = false, isSharedView = false, canMove = true }: { file: RecordModel, viewMode: 'grid' | 'list', onClick: () => void, isSelected: boolean, onToggleSelect: () => void, onRename: (id: string, name: string) => void, onMove: () => void, onDelete: () => void, onToggleStar: () => void, refetch: () => void, user: any, isStarredView?: boolean, isSharedView?: boolean, canMove?: boolean }) {
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
        if (isImage && thumbnailUrl) return <img src={thumbnailUrl} alt="" loading="lazy" className="w-full h-full object-cover" />;
        if (isVideo) return <video src={thumbnailUrl || ''} className="w-full h-full object-cover" preload="none" muted playsInline />;
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

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        downloadSingleFile(file);
        setShowMenu(false);
    };

    const handleRenameClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onRename(file.id, file.name);
        setShowMenu(false);
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
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-surface-900 truncate">{file.name}</span>
                            {file.is_starred && <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />}
                        </div>
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
                                {!isSharedView && (
                                    <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={(e) => { e.stopPropagation(); onToggleStar(); setShowMenu(false); }}>
                                        <Star size={16} className={file.is_starred ? "text-amber-500 fill-amber-500" : "text-surface-400"} /> {file.is_starred ? 'Unstar' : 'Star'}
                                    </button>
                                )}
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleDownload}>
                                    <Download size={16} className="text-surface-400" /> Download
                                </button>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleRenameClick}>
                                    <Edit2 size={16} className="text-surface-400" /> Rename
                                </button>
                                {canMove && !isSharedView && !isStarredView && (
                                    <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={(e) => { e.stopPropagation(); onMove(); setShowMenu(false); }}>
                                        <FolderInput size={16} className="text-surface-400" /> Move
                                    </button>
                                )}

                                {!isSharedView && (
                                    <button
                                        className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            await toggleHidden([{ type: 'file', id: file.id }], !file.is_hidden, user!.id);
                                            refetch();
                                            setShowMenu(false);
                                        }}
                                    >
                                        {file.is_hidden ? (
                                            <><Eye size={16} className="text-surface-400" /> Unhide</>
                                        ) : (
                                            <><EyeOff size={16} className="text-surface-400" /> Hide</>
                                        )}
                                    </button>
                                )}

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
            className={`flex flex-col p-3 bg-white border ${isSelected ? 'border-brand bg-brand/5 shadow-md shadow-brand/10' : 'border-surface-100'} rounded-2xl hover:border-brand/30 hover:shadow-premium cursor-pointer transition-all relative group ${showMenu ? 'z-30' : 'z-auto'} ${file.is_hidden ? 'opacity-50' : 'opacity-100'}`}
            onClick={onClick}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSelect}
                        className={`transition-colors h-6 ${isSelected ? 'text-brand' : 'text-surface-300 hover:text-brand outline-none'}`}
                    >
                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} className="group-hover:opacity-100" />}
                    </button>
                    {file.is_starred &&
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
                            className="cursor-pointer"
                        >
                            <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />
                        </button>
                    }
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
                            <div className="absolute right-0 top-10 w-48 bg-white border border-surface-100 rounded-2xl shadow-premium z-50 py-2 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                {!isSharedView && (
                                    <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={(e) => { e.stopPropagation(); onToggleStar(); setShowMenu(false); }}>
                                        <Star size={16} className={file.is_starred ? "text-amber-500 fill-amber-500" : "text-surface-400"} /> {file.is_starred ? 'Unstar' : 'Star'}
                                    </button>
                                )}
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleDownload}>
                                    <Download size={16} className="text-surface-400" /> Download
                                </button>
                                <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={handleRenameClick}>
                                    <Edit2 size={16} className="text-surface-400" /> Rename
                                </button>
                                {canMove && !isSharedView && !isStarredView && (
                                    <button className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors" onClick={(e) => { e.stopPropagation(); onMove(); setShowMenu(false); }}>
                                        <FolderInput size={16} className="text-surface-400" /> Move
                                    </button>
                                )}

                                {!isSharedView && (
                                    <button
                                        className="w-full text-left px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-3 transition-colors"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            await toggleHidden([{ type: 'file', id: file.id }], !file.is_hidden, user!.id);
                                            refetch();
                                            setShowMenu(false);
                                        }}
                                    >
                                        {file.is_hidden ? (
                                            <><Eye size={16} className="text-surface-400" /> Unhide</>
                                        ) : (
                                            <><EyeOff size={16} className="text-surface-400" /> Hide</>
                                        )}
                                    </button>
                                )}

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
                {getFileIcon(32)}
            </div>

            <div className="flex flex-col px-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-semibold text-surface-900 truncate">{file.name}</span>
                </div>
                <span className="text-[11px] text-surface-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
        </div>
    );
}

