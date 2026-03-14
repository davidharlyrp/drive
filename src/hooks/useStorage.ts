import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pb';
import type { RecordModel } from 'pocketbase';
import { useAuthStore } from '../store/useAuthStore';

export function useStorage(folderId: string, isTrashView: boolean = false) {
    const [folders, setFolders] = useState<RecordModel[]>([]);
    const [files, setFiles] = useState<RecordModel[]>([]);
    const [breadcrumbs, setBreadcrumbs] = useState<RecordModel[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuthStore();

    const fetchItems = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const parentId = folderId === 'root' ? '' : folderId;

            // Fetch Breadcrumbs (Ancestry)
            if (parentId) {
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

            // Fetch children
            let folderRes: RecordModel[] = [];
            try {
                if (isTrashView && folderId === 'root') {
                    // Fetch all trashed folders
                    const allTrashedFolders = await pb.collection('folders').getFullList({
                        filter: `user_id = "${user.id}" && is_trash = true`,
                        sort: 'name',
                    });
                    // A trashed folder is a "root" trash item if its parent is NOT also in the trash
                    const trashedFolderIds = new Set(allTrashedFolders.map(f => f.id));
                    folderRes = allTrashedFolders.filter(f => !f.parent || !trashedFolderIds.has(f.parent));
                } else {
                    const trashFilter = isTrashView ? `is_trash = true` : `is_trash = false`;
                    folderRes = await pb.collection('folders').getFullList({
                        filter: (parentId ? `parent = "${parentId}"` : `parent = ""`) + ` && ` + trashFilter,
                        sort: 'name',
                    });
                }
            } catch (e) { console.warn("Folders fetch error", e); }
            setFolders(folderRes);

            let filesRes: RecordModel[] = [];
            try {
                if (isTrashView && folderId === 'root') {
                    // Fetch all trashed files
                    const allTrashedFiles = await pb.collection('files').getFullList({
                        filter: `user_id = "${user.id}" && is_trash = true`,
                        sort: 'name',
                    });

                    // We need to know which folders are trashed to determine if a file is a "root" trash item
                    // (Its parent folder must NOT be in the trash)
                    const allTrashedFolders = await pb.collection('folders').getFullList({
                        filter: `user_id = "${user.id}" && is_trash = true`,
                    });
                    const trashedFolderIds = new Set(allTrashedFolders.map(f => f.id));

                    filesRes = allTrashedFiles.filter(f => !f.folder_id || !trashedFolderIds.has(f.folder_id));
                } else {
                    const trashFilter = isTrashView ? `is_trash = true` : `is_trash = false`;
                    filesRes = await pb.collection('files').getFullList({
                        filter: (parentId ? `folder_id = "${parentId}"` : `folder_id = ""`) + ` && ` + trashFilter,
                        sort: 'name',
                    });
                }
            } catch (e) { console.warn("Files fetch error", e); }
            setFiles(filesRes);

        } catch (err) {
            console.error('Error fetching items', err);
        } finally {
            setLoading(false);
        }
    }, [folderId, user]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    return { folders, files, breadcrumbs, loading, refetch: fetchItems };
}
