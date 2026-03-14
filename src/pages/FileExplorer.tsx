import { useState, useRef } from 'react';
import { FolderPlus, Upload, LayoutGrid, List, ArrowDownUp, File as FileIcon, Folder as FolderIcon, MoreVertical, Trash2, Edit2, CheckSquare, Square } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStorage } from '../hooks/useStorage';
import type { RecordModel } from 'pocketbase';
import { pb } from '../lib/pb';
import { useAuthStore } from '../store/useAuthStore';
import { FileViewerModal } from '../components/FileViewerModal';
import { UploadProgressModal, type UploadTask } from '../components/UploadProgressModal';

export default function FileExplorer() {
    const { folderId } = useParams();
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const { folders, files, breadcrumbs, loading, refetch } = useStorage(folderId || 'root');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { user, token, updateStorage } = useAuthStore();
    const [previewFile, setPreviewFile] = useState<RecordModel | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedItems, setSelectedItems] = useState<{ type: 'folder' | 'file', id: string }[]>([]);
    const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);

    const handleFolderClick = (id: string) => {
        navigate(`/files/${id}`);
    };

    const handleCreateFolder = async () => {
        const name = prompt("Enter folder name:");
        if (!name || !user) return;
        try {
            await pb.collection('folders').create({
                name,
                parent: folderId === 'root' ? '' : folderId,
                user_id: user.id
            });
            refetch();
        } catch (e: any) { alert(e.message); }
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
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
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

    const handleBatchDelete = async () => {
        if (!selectedItems.length) return;
        if (!confirm(`Delete ${selectedItems.length} selected items?`)) return;

        try {
            for (const item of selectedItems) {
                const collection = item.type === 'folder' ? 'folders' : 'files';
                await pb.collection(collection).delete(item.id);
            }
            setSelectedItems([]);
            refetch();
            updateStorage();
        } catch (err: any) {
            alert('Batch delete failed: ' + err.message);
            refetch();
        }
    };

    const handleRename = async (type: 'folder' | 'file', id: string, currentName: string) => {
        const newName = prompt(`Rename ${type}:`, currentName);
        if (!newName || newName === currentName) return;

        try {
            const collection = type === 'folder' ? 'folders' : 'files';
            await pb.collection(collection).update(id, { name: newName });
            refetch();
        } catch (err: any) {
            alert('Rename failed: ' + err.message);
        }
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
                <div className="absolute inset-0 z-50 bg-army/20 backdrop-blur-sm border-2 border-dashed border-army flex items-center justify-center rounded-compact pointer-events-none transition-all">
                    <div className="bg-mono-950 p-6 rounded-compact shadow-2xl flex flex-col items-center gap-4">
                        <Upload size={48} className="text-army animate-bounce" />
                        <span className="text-xl font-bold text-white">Drop files to upload</span>
                        <span className="text-sm text-mono-400 italic">to current folder</span>
                    </div>
                </div>
            )}

            {/* Breadcrumbs */}
            <div className="flex items-center text-sm mb-4 text-mono-400 overflow-x-auto whitespace-nowrap pb-2">
                <span
                    className="hover:text-white cursor-pointer transition-colors"
                    onClick={() => navigate('/files/root')}
                >
                    My Files
                </span>
                {breadcrumbs.map((crumb) => (
                    <div key={crumb.id} className="flex items-center">
                        <span className="mx-2 text-mono-700">/</span>
                        <span
                            className={`hover:text-white cursor-pointer transition-colors ${crumb.id === folderId ? 'text-white font-medium' : ''}`}
                            onClick={() => navigate(`/files/${crumb.id}`)}
                        >
                            {crumb.name}
                        </span>
                    </div>
                ))}
                {loading && breadcrumbs.length === 0 && folderId !== 'root' && (
                    <span className="mx-2 text-mono-700 animate-pulse">/ ...</span>
                )}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-mono-800 pb-4">
                <div className="flex items-center gap-2">
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                    <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={16} />
                        <span>Upload</span>
                    </button>
                    <button className="btn-secondary" onClick={handleCreateFolder}>
                        <FolderPlus size={16} />
                        <span>New Folder</span>
                    </button>
                    {selectedItems.length > 0 && (
                        <button
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800 rounded-compact transition-colors text-sm"
                            onClick={handleBatchDelete}
                        >
                            <Trash2 size={16} />
                            <span>Delete Selected ({selectedItems.length})</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button className="btn-secondary" title="Sort">
                        <ArrowDownUp size={16} />
                    </button>
                    <div className="flex bg-mono-900 border border-mono-800 rounded-compact p-0.5">
                        <button
                            className={`p-1.5 rounded-compact transition-colors ${viewMode === 'list' ? 'bg-mono-700 text-white' : 'text-mono-400 hover:text-white'}`}
                            onClick={() => setViewMode('list')}
                        >
                            <List size={16} />
                        </button>
                        <button
                            className={`p-1.5 rounded-compact transition-colors ${viewMode === 'grid' ? 'bg-mono-700 text-white' : 'text-mono-400 hover:text-white'}`}
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-32">
                        <div className="animate-spin w-6 h-6 border-2 border-army border-t-transparent rounded-full"></div>
                    </div>
                ) : folders.length === 0 && files.length === 0 ? (
                    <div className="text-center text-mono-500 mt-20">
                        <div className="inline-block p-4 rounded-full bg-mono-900 mb-4">
                            <Upload size={32} className="text-mono-600" />
                        </div>
                        <p className="text-sm">Folder is empty. Upload files or create a folder.</p>
                    </div>
                ) : (
                    <div className={viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" : "flex flex-col gap-2"}>
                        {folders.map(folder => (
                            <FolderItem
                                key={folder.id}
                                folder={folder}
                                viewMode={viewMode}
                                isSelected={selectedItems.some(item => item.id === folder.id)}
                                onToggleSelect={() => toggleSelection('folder', folder.id)}
                                onRename={(id, name) => handleRename('folder', id, name)}
                                onClick={() => handleFolderClick(folder.id)}
                                onRefetch={refetch}
                            />
                        ))}
                        {files.map(file => (
                            <FileItem
                                key={file.id}
                                file={file}
                                viewMode={viewMode}
                                isSelected={selectedItems.some(item => item.id === file.id)}
                                onToggleSelect={() => toggleSelection('file', file.id)}
                                onRename={(id, name) => handleRename('file', id, name)}
                                onRefetch={refetch}
                                onClick={() => setPreviewFile(file)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {previewFile && (
                <FileViewerModal
                    file={previewFile}
                    files={files}
                    onClose={() => setPreviewFile(null)}
                />
            )}

            <UploadProgressModal
                tasks={uploadTasks}
                onClose={() => setUploadTasks([])}
            />
        </div>
    );
}

function FolderItem({ folder, viewMode, onClick, onRefetch, isSelected, onToggleSelect, onRename }: { folder: RecordModel, viewMode: 'grid' | 'list', onClick: () => void, onRefetch: () => void, isSelected: boolean, onToggleSelect: () => void, onRename: (id: string, name: string) => void }) {
    const [showMenu, setShowMenu] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Delete folder?')) {
            try { await pb.collection('folders').delete(folder.id); onRefetch(); }
            catch (err) { alert('Delete failed'); }
        }
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
            <div className={`flex items-center justify-between p-3 bg-mono-900 border ${isSelected ? 'border-army bg-army/5' : 'border-mono-800'} rounded-compact hover:border-mono-600 cursor-pointer transition-colors group`} onClick={onClick}>
                <div className="flex items-center gap-3">
                    <button onClick={handleSelect} className="text-mono-600 hover:text-army transition-colors">
                        {isSelected ? <CheckSquare size={18} className="text-army" /> : <Square size={18} className="opacity-0 group-hover:opacity-100" />}
                    </button>
                    <FolderIcon className="text-mono-400 fill-mono-800" size={20} />
                    <span className="text-sm font-medium text-white">{folder.name}</span>
                </div>
                <div className="relative">
                    <button className="text-mono-500 hover:text-white p-1" onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}><MoreVertical size={16} /></button>
                    {showMenu && (
                        <div className="absolute right-0 mt-1 w-32 bg-mono-950 border border-mono-800 rounded-compact shadow-lg z-20 py-1" onClick={e => e.stopPropagation()}>
                            <button className="w-full text-left px-3 py-1.5 text-sm text-mono-100 hover:bg-mono-800 flex items-center gap-2" onClick={handleRenameClick}>
                                <Edit2 size={14} /> Rename
                            </button>
                            <button className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-mono-800 flex items-center gap-2" onClick={handleDelete}>
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }
    return (
        <div className={`flex flex-col p-3 bg-mono-900 border ${isSelected ? 'border-army bg-army/5' : 'border-mono-800'} rounded-compact hover:border-mono-600 cursor-pointer transition-colors relative group`} onClick={onClick}>
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-start gap-2">
                    <button onClick={handleSelect} className="text-mono-600 hover:text-army transition-colors mt-1">
                        {isSelected ? <CheckSquare size={18} className="text-army" /> : <Square size={18} className="opacity-0 group-hover:opacity-100" />}
                    </button>
                    <FolderIcon className="text-mono-400 fill-mono-800 w-10 h-10" />
                </div>
                <div className="relative">
                    <button className="text-mono-500 hover:text-white p-1" onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}><MoreVertical size={16} /></button>
                    {showMenu && (
                        <div className="absolute right-0 top-6 w-32 bg-mono-950 border border-mono-800 rounded-compact shadow-lg z-20 py-1" onClick={e => e.stopPropagation()}>
                            <button className="w-full text-left px-3 py-1.5 text-sm text-mono-100 hover:bg-mono-800 flex items-center gap-2" onClick={handleRenameClick}>
                                <Edit2 size={14} /> Rename
                            </button>
                            <button className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-mono-800 flex items-center gap-2" onClick={handleDelete}>
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <span className="text-sm font-medium text-white truncate">{folder.name}</span>
        </div>
    )
}

function FileItem({ file, viewMode, onRefetch, onClick, isSelected, onToggleSelect, onRename }: { file: RecordModel, viewMode: 'grid' | 'list', onRefetch: () => void, onClick: () => void, isSelected: boolean, onToggleSelect: () => void, onRename: (id: string, name: string) => void }) {
    const [showMenu, setShowMenu] = useState(false);
    const isImage = file.type?.startsWith('image/') || false;
    const isVideo = file.type?.startsWith('video/') || false;
    const fileUrl = pb.files.getURL(file, file.file);
    const thumbnailUrl = isImage ? pb.files.getURL(file, file.file, { thumb: '100x100' }) : (isVideo ? `${fileUrl}#t=0.001` : null);

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Delete file?')) {
            try { await pb.collection('files').delete(file.id); onRefetch(); }
            catch (err) { alert('Delete failed'); }
        }
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = pb.files.getURL(file, file.file);
        window.open(url, '_blank');
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
            <div className={`flex items-center justify-between p-3 bg-mono-900 border ${isSelected ? 'border-army bg-army/5' : 'border-mono-800'} rounded-compact hover:border-mono-600 cursor-pointer transition-colors group`} onClick={onClick}>
                <div className="flex items-center gap-3">
                    <button onClick={handleSelect} className="text-mono-600 hover:text-army transition-colors">
                        {isSelected ? <CheckSquare size={18} className="text-army" /> : <Square size={18} className="opacity-0 group-hover:opacity-100" />}
                    </button>
                    {isImage && thumbnailUrl ? (
                        <img src={thumbnailUrl} alt="" className="w-32 h-32 object-cover rounded-sm" />
                    ) : isVideo ? (
                        <video
                            src={thumbnailUrl || ''}
                            className="w-32 h-32 object-cover rounded-sm"
                            preload="metadata"
                            muted
                            playsInline
                        />
                    ) : (
                        <FileIcon className="text-army w-32 h-32" />
                    )}
                    <span className="text-sm font-medium text-white">{file.name}</span>
                </div>
                <div className="flex items-center gap-4 relative">
                    <span className="text-xs text-mono-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    <button className="text-mono-500 hover:text-white" onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}><MoreVertical size={16} /></button>
                    {showMenu && (
                        <div className="absolute right-0 top-6 w-32 bg-mono-950 border border-mono-800 rounded-compact shadow-lg z-20 py-1" onClick={e => e.stopPropagation()}>
                            <button className="w-full text-left px-3 py-1.5 text-sm text-mono-100 hover:bg-mono-800 flex items-center gap-2" onClick={handleDownload}>
                                <ArrowDownUp size={14} className="rotate-180" /> Download
                            </button>
                            <button className="w-full text-left px-3 py-1.5 text-sm text-mono-100 hover:bg-mono-800 flex items-center gap-2" onClick={handleRenameClick}>
                                <Edit2 size={14} /> Rename
                            </button>
                            <button className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-mono-800 flex items-center gap-2" onClick={handleDelete}>
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }
    return (
        <div className={`flex flex-col p-3 bg-mono-900 border ${isSelected ? 'border-army bg-army/5' : 'border-mono-800'} rounded-compact hover:border-mono-600 cursor-pointer transition-colors relative group`} onClick={onClick}>
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-start gap-2 w-full">
                    <button onClick={handleSelect} className="text-mono-600 hover:text-army transition-colors mt-1">
                        {isSelected ? <CheckSquare size={18} className="text-army" /> : <Square size={18} className="opacity-0 group-hover:opacity-100" />}
                    </button>
                    <div className="w-full aspect-square flex items-center justify-center bg-mono-950 rounded-compact text-army overflow-hidden">
                        {isImage && thumbnailUrl ? (
                            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : isVideo ? (
                            <video
                                src={thumbnailUrl || ''}
                                className="w-full h-full object-cover"
                                preload="metadata"
                                muted
                                playsInline
                            />
                        ) : (
                            <FileIcon size={24} />
                        )}
                    </div>
                </div>
                <div className="relative">
                    <button className="text-mono-500 hover:text-white p-1" onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}><MoreVertical size={16} /></button>
                    {showMenu && (
                        <div className="absolute right-0 top-6 w-32 bg-mono-950 border border-mono-800 rounded-compact shadow-lg z-20 py-1" onClick={e => e.stopPropagation()}>
                            <button className="w-full text-left px-3 py-1.5 text-sm text-mono-100 hover:bg-mono-800 flex items-center gap-2" onClick={handleDownload}>
                                <ArrowDownUp size={14} className="rotate-180" /> Download
                            </button>
                            <button className="w-full text-left px-3 py-1.5 text-sm text-mono-100 hover:bg-mono-800 flex items-center gap-2" onClick={handleRenameClick}>
                                <Edit2 size={14} /> Rename
                            </button>
                            <button className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-mono-800 flex items-center gap-2" onClick={handleDelete}>
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <span className="text-sm text-white truncate mb-1">{file.name}</span>
            <span className="text-xs text-mono-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
        </div>
    )
}
