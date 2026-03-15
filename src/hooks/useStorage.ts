import { useState, useEffect, useCallback, useRef } from 'react';
import { pb } from '../lib/pb';
import type { RecordModel } from 'pocketbase';
import { useAuthStore } from '../store/useAuthStore';

const PAGE_SIZE = 50;

export function useStorage(folderId: string, isTrashView: boolean = false, isStarredView: boolean = false, isSharedView: boolean = false, showHidden: boolean = false) {
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

    const fetchItems = useCallback(async (isLoadMore = false, silent = false) => {
        if (!user) return;

        const currentPage = isLoadMore ? page + 1 : 1;
        if (!isLoadMore) {
            if (!silent) {
                setLoading(true);
                setFolders([]);
                setFiles([]);
                setTotalFiles(0);
                setTotalFolders(0);
            }
        } else {
            setLoadingMore(true);
        }

        try {
            let filterAccess = `(user_id = "${user.id}" || shared_with ~ "${user.id}")`;

            // In "My Files" root and "Starred" view, only show items owned by the user to avoid duplicates from "Shared with me"
            if (!isSharedView && !isTrashView && (isStarredView || (folderId === 'root' || !folderId))) {
                filterAccess = `user_id = "${user.id}"`;
            }
            const trashFilter = isTrashView ? `is_trash = true` : `is_trash = false`;
            const hideFilter = showHidden ? `` : ` && is_hidden = false`;
            let combinedFilter = `${filterAccess} && ${trashFilter}${hideFilter}`;

            // In Starred view, we always want is_starred items.
            // But at root, we only want to show "Entry Points" (starred items whose parent is NOT starred)
            // to avoid duplication: if a folder is starred, we only show the folder at root, not all its children.
            if (isStarredView) {
                if (folderId === 'root' || !folderId) {
                    // This is slightly complex for PocketBase filters, assuming relation dot-notation works.
                    // If not, we might need a different approach, but let's try this standard PB relation filter.
                    // We check if it's starred AND (parent is empty OR parent is not starred).
                }
                combinedFilter += ` && is_starred = true`;
            }

            const parentId = folderId === 'root' ? '' : folderId;

            // Breadcrumbs
            if (!isLoadMore) {
                if (parentId && !isTrashView) {
                    const crumbs: RecordModel[] = [];
                    let currentId = parentId;
                    while (currentId) {
                        try {
                            const folder = await pb.collection('folders').getOne(currentId);
                            // In Starred view, we stop if we hit an unstarred folder
                            if (isStarredView && !folder.is_starred) break;

                            crumbs.unshift(folder);
                            currentId = folder.parent;
                        } catch { break; }
                    }
                    setBreadcrumbs(crumbs);
                } else {
                    setBreadcrumbs([]);
                }
            }

            let folderFilter = combinedFilter;
            let fileFilter = combinedFilter;

            if (isStarredView && (folderId === 'root' || !folderId)) {
                // Starred Root: Filter out items whose parents are also starred to prevent duplication
                folderFilter += ` && (parent = "" || parent.is_starred = false)`;
                fileFilter += ` && (folder_id = "" || folder_id.is_starred = false)`;
            } else if (isSharedView && folderId === 'root') {
                // Shared Root: Show only items shared with me whose parent is NOT shared with me 
                // AND whose parent is NOT owned by me.
                // This creates a clean "entry point" view and prevents duplication of items visible in "My Files".

                const sharedFilter = `shared_with ~ "${user.id}" && user_id != "${user.id}" && is_trash = false${hideFilter}`;
                const allSharedFolders = await pb.collection('folders').getFullList({
                    filter: sharedFilter,
                });
                const sharedFolderIds = new Set(allSharedFolders.map(f => f.id));

                const allSharedFiles = await pb.collection('files').getFullList({
                    filter: sharedFilter,
                });

                // To check parent ownership efficiently, we'll identify potential entry points 
                // and verify those that have parents not in the shared set.
                const checkIsRoot = async (parentId: string) => {
                    if (!parentId) return true;
                    if (sharedFolderIds.has(parentId)) return false;
                    try {
                        const parent = await pb.collection('folders').getOne(parentId);
                        // If I own the parent, this item is part of my own hierarchy, not a shared entry point.
                        return parent.user_id !== user.id;
                    } catch {
                        return true; // Parent missing or inaccessible
                    }
                };

                const folderRoots: RecordModel[] = [];
                for (const f of allSharedFolders) {
                    if (await checkIsRoot(f.parent)) folderRoots.push(f);
                }

                const fileRoots: RecordModel[] = [];
                for (const f of allSharedFiles) {
                    if (await checkIsRoot(f.folder_id)) fileRoots.push(f);
                }

                setFolders(folderRoots);
                setFiles(fileRoots);
                setTotalFolders(folderRoots.length);
                setTotalFiles(fileRoots.length);
                setHasMore(false);
                setLoading(false);
                setLoadingMore(false);
                return;
            } else if (isTrashView && folderId === 'root') {
                // Trash root logic
            } else {
                folderFilter += ` && ${parentId ? `parent = "${parentId}"` : `parent = ""`}`;
                fileFilter += ` && ${parentId ? `folder_id = "${parentId}"` : `folder_id = ""`}`;
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
    }, [folderId, user, page, isTrashView, isStarredView, isSharedView, showHidden]);

    useEffect(() => {
        fetchItems(false);
    }, [folderId, isTrashView, isStarredView, isSharedView, showHidden]);

    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

    const debouncedRefetch = useCallback(() => {
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
        debounceTimeout.current = setTimeout(() => {
            fetchItems(false, true); // Silent fetch for realtime
        }, 500); // 500ms debounce
    }, [fetchItems]);

    // Realtime subscriptions for global sync
    useEffect(() => {
        if (!user) return;

        console.log('Initializing realtime subscriptions for storage sync...');

        const subscribeToChanges = async () => {
            const unsubFiles = await pb.collection('files').subscribe('*', (e) => {
                console.log('Realtime file change detected:', e.action);
                debouncedRefetch();
            });

            const unsubFolders = await pb.collection('folders').subscribe('*', (e) => {
                console.log('Realtime folder change detected:', e.action);
                debouncedRefetch();
            });

            return () => {
                unsubFiles();
                unsubFolders();
            };
        };

        const cleanup = subscribeToChanges();

        return () => {
            cleanup.then(unsub => unsub());
            if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        };
    }, [user, debouncedRefetch]);

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
        refetch: (silent = false) => fetchItems(false, silent)
    };
}
