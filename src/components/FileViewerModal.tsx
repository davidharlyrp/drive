import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, File as FileIcon } from 'lucide-react';
import type { RecordModel } from 'pocketbase';
import { pb } from '../lib/pb';

interface FileViewerModalProps {
    file: RecordModel;
    files: RecordModel[]; // all files in the current view to allow next/prev for images
    onClose: () => void;
}

export function FileViewerModal({ file, files, onClose }: FileViewerModalProps) {
    const isText = file.type?.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md') || false;

    // Media files for the slider (images and videos)
    const mediaFiles = files.filter(f => f.type?.startsWith('image/') || f.type?.startsWith('video/'));
    const initialIndex = mediaFiles.findIndex(f => f.id === file.id);
    const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
    const [textContent, setTextContent] = useState<string | null>(null);

    // If the opened file is not an image or video, it won't be in mediaFiles
    const isNavigatable = mediaFiles.length > 0 && initialIndex >= 0;
    const activeFile = isNavigatable ? mediaFiles[currentIndex] : file;
    const fileUrl = pb.files.getURL(activeFile, activeFile.file);

    const activeIsImage = activeFile.type?.startsWith('image/') || false;
    const activeIsVideo = activeFile.type?.startsWith('video/') || false;

    useEffect(() => {
        if (isText) {
            fetch(fileUrl)
                .then(res => res.text())
                .then(text => setTextContent(text))
                .catch(() => setTextContent('Error loading text content.'));
        }
    }, [isText, fileUrl]);

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

    const handlePrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : mediaFiles.length - 1));
    };

    const handleNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex(prev => (prev < mediaFiles.length - 1 ? prev + 1 : 0));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent z-10" onClick={e => e.stopPropagation()}>
                <span className="text-white font-medium truncate px-4">{activeFile.name}</span>
                <button className="text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors" onClick={onClose}>
                    <X size={24} />
                </button>
            </div>

            {/* Content Viewer */}
            <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-12" onClick={e => e.stopPropagation()}>
                {activeIsImage && (
                    <img
                        src={fileUrl}
                        alt={activeFile.name}
                        className="max-w-full max-h-full object-contain select-none"
                    />
                )}

                {activeIsVideo && (
                    <video
                        key={activeFile.id}
                        src={fileUrl}
                        controls
                        autoPlay
                        muted
                        playsInline
                        className="max-w-full max-h-full rounded-compact shadow-2xl"
                    />
                )}

                {isNavigatable && mediaFiles.length > 1 && (
                    <>
                        <button className="absolute left-4 p-3 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors z-20" onClick={handlePrev}>
                            <ChevronLeft size={32} />
                        </button>
                        <button className="absolute right-4 p-3 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors z-20" onClick={handleNext}>
                            <ChevronRight size={32} />
                        </button>
                        <div className="absolute bottom-4 left-0 right-0 text-center text-white/50 text-sm z-20">
                            {currentIndex + 1} / {mediaFiles.length}
                        </div>
                    </>
                )}

                {isText && (
                    <div className="w-full max-w-4xl h-full max-h-[80vh] bg-mono-950 p-6 sm:p-8 rounded-compact border border-mono-800 shadow-2xl overflow-y-auto">
                        {textContent === null ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="animate-spin w-6 h-6 border-2 border-army border-t-transparent rounded-full"></div>
                            </div>
                        ) : (
                            <pre className="text-mono-100 text-sm whitespace-pre-wrap font-mono break-words leading-relaxed">
                                {textContent}
                            </pre>
                        )}
                    </div>
                )}

                {!activeIsImage && !activeIsVideo && !isText && (
                    <div className="flex flex-col items-center bg-mono-900 p-8 rounded-compact border border-mono-800 text-center">
                        <FileIcon size={64} className="text-mono-500 mb-4" />
                        <h3 className="text-white font-medium mb-2">No Preview Available</h3>
                        <p className="text-sm text-mono-400 mb-6">This file type cannot be previewed in the browser.</p>
                        <a
                            href={fileUrl}
                            download
                            target="_blank"
                            rel="noreferrer"
                            className="btn-primary"
                        >
                            Download File
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
