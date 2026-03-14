import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, File as FileIcon, Trash2, Edit2, FolderInput, MoreVertical, Star } from 'lucide-react';
import type { RecordModel } from 'pocketbase';
import { pb } from '../lib/pb';
import { toggleStarred } from '../utils/starredHelper';

interface FileViewerModalProps {
    file: RecordModel;
    files: RecordModel[]; // all files in the current view to allow next/prev for images
    onClose: () => void;
    onRefetch: () => void; // needed to refresh the list after saving an edited file
    onRename?: (file: RecordModel) => void;
    onMove?: (file: RecordModel) => void;
    onDelete?: (file: RecordModel) => void;
    onDownload?: (file: RecordModel) => void;
    totalFiles?: number;
    hasMore?: boolean;
    onLoadMore?: () => void;
}

export function FileViewerModal({ file, files, onClose, onRefetch, onRename, onMove, onDelete, onDownload, totalFiles, hasMore, onLoadMore }: FileViewerModalProps) {
    const initialIndex = files.findIndex(f => f.id === file.id);
    const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
    const [translateY, setTranslateY] = useState(0);
    const touchStart = useRef<{ x: number, y: number } | null>(null);
    const touchEnd = useRef<{ x: number, y: number } | null>(null);

    const isNavigatable = files.length > 0 && initialIndex >= 0;
    const activeFile = isNavigatable ? files[currentIndex] : file;
    const fileUrl = pb.files.getURL(activeFile, activeFile.file);

    const activeIsImage = activeFile.type?.startsWith('image/') || false;
    const activeIsVideo = activeFile.type?.startsWith('video/') || false;
    const activeIsPdf = activeFile.type === 'application/pdf' || activeFile.name.endsWith('.pdf');
    const activeIsText = activeFile.type?.startsWith('text/') || activeFile.name.endsWith('.txt') || activeFile.name.endsWith('.md') || false;

    useEffect(() => {
        if (activeIsText) {
            setTextContent(null);
            fetch(fileUrl)
                .then(res => res.text())
                .then(text => setTextContent(text))
                .catch(() => setTextContent('Error loading text content.'));
        }
    }, [activeIsText, fileUrl]);

    useEffect(() => {
        let objectUrl: string | null = null;
        if (activeIsPdf) {
            setPdfUrl(null);
            fetch(fileUrl)
                .then(res => res.blob())
                .then(blob => {
                    objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
                    setPdfUrl(objectUrl);
                })
                .catch(console.error);
        }
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [activeIsPdf, fileUrl]);

    // Handle Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (isNavigatable) {
                if (e.key === 'ArrowLeft') handlePrev();
                if (e.key === 'ArrowRight') handleNext();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isNavigatable, currentIndex]);

    // Load more when reaching near the end of the current array
    useEffect(() => {
        if (hasMore && onLoadMore && currentIndex >= files.length - 2) {
            onLoadMore();
        }
    }, [currentIndex, files.length, hasMore, onLoadMore]);

    const handlePrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setSlideDirection('left');
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : files.length - 1));
    };

    const handleNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setSlideDirection('right');
        setCurrentIndex(prev => (prev < files.length - 1 ? prev + 1 : 0));
    };

    // Swipe handlers
    const onTouchStart = (e: React.TouchEvent) => {
        touchEnd.current = null;
        touchStart.current = {
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        };
        setTranslateY(0);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        touchEnd.current = {
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        };

        // Horizontal swiping: disable vertical feedback if mostly moving horizontal
        if (!touchStart.current || !touchEnd.current) return;
        const deltaX = Math.abs(touchStart.current.x - touchEnd.current.x);
        const deltaY = touchEnd.current.y - touchStart.current.y;

        // Vertical "pull-to-close" feedback (only downward)
        if (deltaY > 0 && deltaY > deltaX) {
            setTranslateY(deltaY * 0.4); // Resistance effect
        } else {
            setTranslateY(0);
        }
    };

    const onTouchEnd = () => {
        if (!touchStart.current || !touchEnd.current) {
            setTranslateY(0);
            return;
        }

        const deltaX = touchStart.current.x - touchEnd.current.x;
        const deltaY = touchEnd.current.y - touchStart.current.y;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // Reset feedback
        setTranslateY(0);

        // Horizontal navigation
        if (absX > 50 && absX > absY) {
            if (deltaX > 0) handleNext();
            else handlePrev();
        }
        // Vertical close (swipe down)
        else if (deltaY > 120 && absY > absX) {
            onClose();
        }
    };

    const handleSaveText = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!textContent) return;

        try {
            setIsSaving(true);
            const blob = new Blob([textContent], { type: activeFile.type || 'text/plain' });

            const formData = new FormData();
            formData.append('file', blob, activeFile.name);

            await pb.collection('files').update(activeFile.id, formData);

            setIsEditing(false);
            onRefetch(); // Refresh explorer view to update size/modified date
        } catch (error) {
            console.error('Failed to save file:', error);
            alert('Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/40 backdrop-blur-2xl animate-in fade-in duration-500" onClick={onClose}>
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-2 bg-white/40 border-b border-surface-100 z-10 backdrop-blur-md" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col min-w-0 flex-1 mr-4">
                    <span className="text-xl font-bold text-surface-900 truncate" title={activeFile.name}>
                        {activeFile.name}
                    </span>
                    <p className="text-[10px] font-semibold text-surface-400 mt-0.5">
                        {currentIndex + 1} of {totalFiles || files.length || 1} items
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {activeIsText && !isEditing && (
                        <button
                            className="bg-brand text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-brand-dark transition-all shadow-md shadow-brand/20 active:scale-95"
                            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                        >
                            Edit File
                        </button>
                    )}
                    {activeIsText && isEditing && (
                        <div className="flex items-center gap-2">
                            <button
                                className="bg-white border border-surface-200 text-surface-600 text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-surface-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                onClick={(e) => { e.stopPropagation(); setIsEditing(false); setPdfUrl(null); }}
                                disabled={isSaving}
                            >
                                Cancel
                            </button>
                            <button
                                className="bg-brand text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-brand-dark transition-all shadow-md shadow-brand/20 active:scale-95 flex items-center gap-2 disabled:opacity-50"
                                onClick={handleSaveText}
                                disabled={isSaving}
                            >
                                {isSaving && <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>}
                                Save Changes
                            </button>
                        </div>
                    )}

                    {!isEditing && (
                        <div className="flex items-center gap-1 sm:gap-3">
                            {/* Desktop Buttons */}
                            <div className="hidden md:flex items-center gap-1 sm:gap-3">
                                <button
                                    className="text-surface-400 hover:text-amber-500 p-2.5 rounded-full hover:bg-amber-50 transition-all border border-transparent hover:border-amber-100"
                                    title={activeFile.is_starred ? "Unstar" : "Star"}
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        await toggleStarred([{ type: 'file', id: activeFile.id }], !activeFile.is_starred, pb.authStore.model!.id);
                                        onRefetch();
                                    }}
                                >
                                    <Star size={20} className={activeFile.is_starred ? "fill-amber-500 text-amber-500" : ""} />
                                </button>
                                {onRename && (
                                    <button
                                        className="text-surface-400 hover:text-surface-900 p-2.5 rounded-full hover:bg-surface-100 transition-all border border-transparent hover:border-surface-50"
                                        title="Rename"
                                        onClick={(e) => { e.stopPropagation(); onClose(); onRename(activeFile); }}
                                    >
                                        <Edit2 size={20} />
                                    </button>
                                )}
                                {onMove && (
                                    <button
                                        className="text-surface-400 hover:text-surface-900 p-2.5 rounded-full hover:bg-surface-100 transition-all border border-transparent hover:border-surface-50"
                                        title="Move"
                                        onClick={(e) => { e.stopPropagation(); onClose(); onMove(activeFile); }}
                                    >
                                        <FolderInput size={20} />
                                    </button>
                                )}
                                {onDownload && (
                                    <button
                                        className="text-surface-400 hover:text-surface-900 p-2.5 rounded-full hover:bg-surface-100 transition-all border border-transparent hover:border-surface-50"
                                        title="Download"
                                        onClick={(e) => { e.stopPropagation(); onDownload(activeFile); }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        className="text-surface-400 hover:text-red-600 p-2.5 rounded-full hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
                                        title="Delete"
                                        onClick={(e) => { e.stopPropagation(); onClose(); onDelete(activeFile); }}
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                            </div>

                            {/* Mobile More Button */}
                            <div className="relative md:hidden flex items-center">
                                <button
                                    className={`text-surface-400 hover:text-surface-900 p-2.5 rounded-full hover:bg-surface-100 transition-all border border-transparent hover:border-surface-50 ${isMenuOpen ? 'bg-surface-100 text-surface-900 border-surface-200' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                                >
                                    <MoreVertical size={20} />
                                </button>

                                {isMenuOpen && (
                                    <div
                                        className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-premium border border-surface-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 flex flex-col"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <button
                                            className="w-full text-left px-4 py-2.5 text-sm font-semibold text-surface-700 hover:bg-surface-50 hover:text-brand flex items-center gap-3 transition-colors"
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                await toggleStarred([{ type: 'file', id: activeFile.id }], !activeFile.is_starred, pb.authStore.model!.id);
                                                onRefetch();
                                                setIsMenuOpen(false);
                                            }}
                                        >
                                            <Star size={18} className={activeFile.is_starred ? "fill-amber-500 text-amber-500" : "opacity-70"} /> {activeFile.is_starred ? "Unstar" : "Star"}
                                        </button>
                                        {onRename && (
                                            <button
                                                className="w-full text-left px-4 py-2.5 text-sm font-semibold text-surface-700 hover:bg-surface-50 hover:text-brand flex items-center gap-3 transition-colors"
                                                onClick={(e) => { e.stopPropagation(); onClose(); onRename(activeFile); }}
                                            >
                                                <Edit2 size={18} className="opacity-70" /> Rename
                                            </button>
                                        )}
                                        {onMove && (
                                            <button
                                                className="w-full text-left px-4 py-2.5 text-sm font-semibold text-surface-700 hover:bg-surface-50 hover:text-brand flex items-center gap-3 transition-colors"
                                                onClick={(e) => { e.stopPropagation(); onClose(); onMove(activeFile); }}
                                            >
                                                <FolderInput size={18} className="opacity-70" /> Move
                                            </button>
                                        )}
                                        {onDownload && (
                                            <button
                                                className="w-full text-left px-4 py-2.5 text-sm font-semibold text-surface-700 hover:bg-surface-50 hover:text-brand flex items-center gap-3 transition-colors"
                                                onClick={(e) => { e.stopPropagation(); onDownload(activeFile); setIsMenuOpen(false); }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                                Download
                                            </button>
                                        )}
                                        {onDelete && (
                                            <>
                                                <div className="h-px bg-surface-50 my-1 mx-2"></div>
                                                <button
                                                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); onClose(); onDelete(activeFile); }}
                                                >
                                                    <Trash2 size={18} className="opacity-70" /> Delete
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <button
                        className="text-surface-400 hover:text-surface-900 p-2.5 rounded-full hover:bg-surface-100 transition-all border border-surface-50 shadow-sm ml-2"
                        onClick={onClose}
                    >
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* Content Viewer */}
            <div
                className="relative w-full h-full flex items-center justify-center p-2 sm:p-24 transition-transform duration-200 ease-out"
                style={{ transform: `translateY(${translateY}px)` }}
                onClick={() => { setIsMenuOpen(false); }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <div
                    key={activeFile.id}
                    className={`w-full h-full flex items-center justify-center ${slideDirection === 'right' ? 'slide-in-right' : slideDirection === 'left' ? 'slide-in-left' : ''}`}
                    onAnimationEnd={() => setSlideDirection(null)}
                >
                    {activeIsImage && (
                        <div className="relative group p-0 md:p-2 bg-white rounded-[2rem] shadow-premium">
                            <img
                                src={fileUrl}
                                alt={activeFile.name}
                                className="max-w-full h-full md:max-h-[75vh] object-contain select-none rounded-[1.5rem]"
                            />
                        </div>
                    )}

                    {activeIsVideo && (
                        <div className="relative p-0 md:p-2 bg-white rounded-[2rem] shadow-premium overflow-hidden">
                            <video
                                key={activeFile.id}
                                src={fileUrl}
                                controls
                                autoPlay
                                muted
                                playsInline
                                className="max-w-full h-full md:max-h-[75vh] rounded-[1.8rem] shadow-2xl"
                            />
                        </div>
                    )}

                    {activeIsPdf && (
                        <div className="w-full max-w-5xl h-full max-h-[85vh] mt-2 bg-white rounded-2xl shadow-premium border border-surface-100 overflow-hidden">
                            {pdfUrl ? (
                                <iframe
                                    src={`${pdfUrl}#toolbar=0`}
                                    className="w-full h-full border-none"
                                    title={activeFile.name}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full gap-4">
                                    <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full"></div>
                                    <span className="text-xs font-semibold text-surface-400 animate-pulse">Loading Document...</span>
                                </div>
                            )}
                        </div>
                    )}

                    {activeIsText && (
                        <div className="w-full max-w-5xl h-full max-h-[75vh] bg-white p-8 sm:p-10 rounded-2xl border border-surface-100 shadow-premium overflow-hidden flex flex-col">
                            {textContent === null ? (
                                <div className="flex flex-col items-center justify-center h-full gap-4">
                                    <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full"></div>
                                    <span className="text-xs font-semibold text-surface-400 animate-pulse">Loading Source...</span>
                                </div>
                            ) : isEditing ? (
                                <textarea
                                    value={textContent || ''}
                                    onChange={(e) => setTextContent(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full h-full flex-1 resize-none bg-surface-50 border border-surface-200 rounded-xl p-5 text-surface-900 font-mono text-[13px] leading-relaxed focus:outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand/40 transition-all shadow-inner custom-scrollbar"
                                    spellCheck={false}
                                />
                            ) : (
                                <div className="overflow-y-auto custom-scrollbar flex-1 pr-4">
                                    <pre className="text-surface-600 text-[13px] whitespace-pre-wrap font-mono break-words leading-relaxed selection:bg-brand/10 selection:text-brand">
                                        {textContent}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}

                    {!activeIsImage && !activeIsVideo && !activeIsText && !activeIsPdf && (
                        <div className="flex flex-col items-center bg-white p-12 rounded-2xl border border-surface-100 text-center shadow-premium max-w-md">
                            <div className="w-24 h-24 bg-surface-50 rounded-[2rem] flex items-center justify-center mb-8 border border-surface-100">
                                <FileIcon size={48} className="text-surface-300" />
                            </div>
                            <h3 className="text-2xl font-black text-surface-900 mb-3">No Preview Available</h3>
                            <p className="text-sm font-medium text-surface-400 mb-10 leading-relaxed">
                                This extension ({activeFile.type?.split('/')[1]?.toUpperCase() || 'FILE'}) cannot be previewed. Would you like to download it instead?
                            </p>
                            <a
                                href={fileUrl}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="w-full bg-brand hover:shadow-lg hover:shadow-brand/20 text-white py-5 px-10 rounded-2xl font-bold transition-all active:scale-95 text-center flex items-center justify-center gap-2"
                            >
                                Download Document
                            </a>
                        </div>
                    )}
                </div>

                {isNavigatable && files.length > 1 && (
                    <>
                        <button
                            className="hidden md:block md:absolute left-6 sm:left-10 p-4 sm:p-5 rounded-xl bg-white/80 text-surface-900 border border-surface-100 shadow-premium hover:bg-brand hover:text-white transition-all z-20 active:scale-90"
                            onClick={handlePrev}
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <button
                            className="hidden md:block md:absolute right-6 sm:right-10 p-4 sm:p-5 rounded-xl bg-white/80 text-surface-900 border border-surface-100 shadow-premium hover:bg-brand hover:text-white transition-all z-20 active:scale-90"
                            onClick={handleNext}
                        >
                            <ChevronRight size={24} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
