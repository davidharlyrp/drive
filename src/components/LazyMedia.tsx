import { useState, useRef, useEffect, useCallback } from 'react';

interface LazyMediaProps {
    type: 'image' | 'video';
    src: string;
    alt?: string;
    className?: string;
    rootMargin?: string;
    /** For video: show a play icon overlay */
    showPlayIcon?: boolean;
}

/**
 * LazyMedia — loads media only when the element enters the viewport.
 * Uses IntersectionObserver for efficient viewport detection.
 * Aborts in-flight downloads on unmount to free browser connections.
 */
export function LazyMedia({
    type,
    src,
    alt = '',
    className = '',
    rootMargin = '200px',
    showPlayIcon = false,
}: LazyMediaProps) {
    const [isInView, setIsInView] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.unobserve(el);
                }
            },
            { rootMargin }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [rootMargin]);

    // Abort in-flight downloads on unmount to free browser connections
    // This prevents old folder's thumbnails from blocking new folder's thumbnails
    useEffect(() => {
        return () => {
            // Cancel image download
            if (imgRef.current) {
                imgRef.current.src = '';
            }
            // Cancel video download
            if (videoRef.current) {
                videoRef.current.removeAttribute('src');
                videoRef.current.load(); // forces browser to abort the previous source
            }
        };
    }, []);

    const onImgLoad = useCallback(() => setIsLoaded(true), []);
    const onVideoLoad = useCallback(() => setIsLoaded(true), []);

    return (
        <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
            {/* Skeleton placeholder — shown until media loads */}
            {!isLoaded && (
                <div className="absolute inset-0 bg-surface-100 animate-pulse" />
            )}

            {isInView && type === 'image' && (
                <img
                    ref={imgRef}
                    src={src}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={onImgLoad}
                />
            )}

            {isInView && type === 'video' && (
                <>
                    <video
                        ref={videoRef}
                        src={src}
                        className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                        preload="metadata"
                        muted
                        playsInline
                        onLoadedData={onVideoLoad}
                    />
                    {showPlayIcon && isLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                            <div className="w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                                <div className="w-0 h-0 border-t-4 border-t-transparent border-l-6 border-l-white border-b-4 border-b-transparent ml-1"></div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* If not yet in view, render nothing — just the skeleton */}
            {!isInView && type === 'video' && showPlayIcon && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 bg-surface-200 rounded-full flex items-center justify-center">
                        <div className="w-0 h-0 border-t-4 border-t-transparent border-l-6 border-l-surface-400 border-b-4 border-b-transparent ml-1"></div>
                    </div>
                </div>
            )}
        </div>
    );
}
