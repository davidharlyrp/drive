import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pb';
import type { RecordModel } from 'pocketbase';
import { useAuthStore } from '../store/useAuthStore';

export function useStorage(folderId: string) {
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
                folderRes = await pb.collection('folders').getFullList({
                    filter: parentId ? `parent = "${parentId}"` : `parent = ""`,
                    sort: 'name',
                });
            } catch (e) { console.warn("Folders fetch error", e); }
            setFolders(folderRes);

            let filesRes: RecordModel[] = [];
            try {
                filesRes = await pb.collection('files').getFullList({
                    filter: parentId ? `folder_id = "${parentId}"` : `folder_id = ""`,
                    sort: 'name',
                });
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
