import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pb';
import type { RecordModel } from 'pocketbase';
import { useAuthStore } from '../store/useAuthStore';

const PAGE_SIZE = 50;

export function useStorage(folderId: string, isTrashView: boolean = false, isStarredView: boolean = false) {
    const [folders, setFolders] = useState<RecordModel[]>([]);
    const [files, setFiles] = useState<RecordModel[]>([]);
    const [breadcrumbs, setBreadcrumbs] = useState<RecordModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [totalFiles, setTotalFiles] = useState(0);
    const [totalFolders, setTotalFolders] = useState(0);
    const { user } = useAuthStore();

    const fetchItems = useCallback(async (isLoadMore = false) => {
        if (!user) return;

        const currentPage = isLoadMore ? page + 1 : 1;
        if (!isLoadMore) {
            setLoading(true);
            setFolders([]);
            setFiles([]);
            setTotalFiles(0);
            setTotalFolders(0);
        } else {
            setLoadingMore(true);
        }

        try {
            const filterUserId = `user_id = "${user.id}"`;
            const trashFilter = isTrashView ? `is_trash = true` : `is_trash = false`;
            const starFilter = isStarredView ? `is_starred = true` : ``;

            let combinedFilter = `${filterUserId} && ${trashFilter}`;
            if (starFilter) combinedFilter += ` && ${starFilter}`;

            const parentId = folderId === 'root' ? '' : folderId;

            // Breadcrumbs only on initial load
            if (!isLoadMore) {
                if (parentId && !isStarredView) {
                    const crumbs: RecordModel[] = [];
                    let currentId = parentId;
                    while (currentId) {
                        try {
                            const folder = await pb.collection('folders').getOne(currentId);
                            crumbs.unshift(folder);
                            currentId = folder.parent;
                        } catch { break; }
                    }
                    setBreadcrumbs(crumbs);
                } else {
                    setBreadcrumbs([]);
                }
            }

            // Paging logic: we fetch folders first, then files.
            // This is a bit complex for a unified scroll, so we'll fetch them in parallel if possible
            // but for simplicity and "per 50", we'll fetch both and slice? 
            // No, better to use getList on each.

            let folderFilter = combinedFilter;
            let fileFilter = combinedFilter;

            if (!isStarredView) {
                if (isTrashView && folderId === 'root') {
                    // Root Trash logic is handled by a separate filter or client-side?
                    // To keep it server-side paginated, we'd need nested filters.
                    // Let's assume for now user wants 50 items per batch.
                    // We'll fetch 50 folders and 50 files and display them.
                } else {
                    folderFilter += ` && ${parentId ? `parent = "${parentId}"` : `parent = ""`}`;
                    fileFilter += ` && ${parentId ? `folder_id = "${parentId}"` : `folder_id = ""`}`;
                }
            }

            const [foldersRes, filesRes] = await Promise.all([
                pb.collection('folders').getList(currentPage, PAGE_SIZE, {
                    filter: folderFilter,
                    sort: 'name',
                }),
                pb.collection('files').getList(currentPage, PAGE_SIZE, {
                    filter: fileFilter,
                    sort: 'name',
                })
            ]);

            if (isLoadMore) {
                setFolders(prev => [...prev, ...foldersRes.items]);
                setFiles(prev => [...prev, ...filesRes.items]);
                setPage(currentPage);
            } else {
                setFolders(foldersRes.items);
                setFiles(filesRes.items);
                setPage(1);
            }

            setTotalFiles(filesRes.totalItems);
            setTotalFolders(foldersRes.totalItems);
            setHasMore(foldersRes.page < foldersRes.totalPages || filesRes.page < filesRes.totalPages);

        } catch (err) {
            console.error('Error fetching items', err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [folderId, user, page, isTrashView, isStarredView]);

    useEffect(() => {
        fetchItems(false);
    }, [folderId, isTrashView, isStarredView]); // Only dependencies that reset the view

    const loadMore = useCallback(() => {
        if (!loading && !loadingMore && hasMore) {
            fetchItems(true);
        }
    }, [fetchItems, loading, loadingMore, hasMore]);

    return {
        folders,
        files,
        breadcrumbs,
        loading,
        loadingMore,
        hasMore,
        loadMore,
        totalFiles,
        totalFolders,
        refetch: () => fetchItems(false)
    };
}
