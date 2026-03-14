import { pb } from '../lib/pb';

export async function getRecursiveItems(folderId: string): Promise<{ folders: string[], files: string[] }> {
    const foldersToProcess = [folderId];
    const foundFolders = [folderId];
    const foundFiles: string[] = [];

    while (foldersToProcess.length > 0) {
        const currentId = foldersToProcess.pop()!;

        // Fetch subfolders
        try {
            const subfolders = await pb.collection('folders').getFullList({
                filter: `parent = "${currentId}"`
            });
            for (const f of subfolders) {
                foundFolders.push(f.id);
                foldersToProcess.push(f.id);
            }
        } catch (e) { console.error("Error fetching subfolders", e); }

        // Fetch files
        try {
            const files = await pb.collection('files').getFullList({
                filter: `folder_id = "${currentId}"`
            });
            for (const f of files) {
                foundFiles.push(f.id);
            }
        } catch (e) { console.error("Error fetching files", e); }
    }

    return { folders: foundFolders, files: foundFiles };
}

export async function moveToTrash(items: { type: 'folder' | 'file', id: string }[]) {
    for (const item of items) {
        if (item.type === 'file') {
            await pb.collection('files').update(item.id, { is_trash: true });
        } else if (item.type === 'folder') {
            const { folders, files } = await getRecursiveItems(item.id);
            for (const fId of files) await pb.collection('files').update(fId, { is_trash: true });
            for (const foldId of folders) await pb.collection('folders').update(foldId, { is_trash: true });
        }
    }
}

export async function permanentDelete(items: { type: 'folder' | 'file', id: string }[]) {
    for (const item of items) {
        if (item.type === 'file') {
            await pb.collection('files').delete(item.id);
        } else if (item.type === 'folder') {
            // In PocketBase, deleting a folder might not auto-delete children unless setup via cascading rules,
            // so we recursively delete manually just in case.
            const { folders, files } = await getRecursiveItems(item.id);
            for (const fId of files) {
                try { await pb.collection('files').delete(fId); } catch { }
            }
            // Delete lowest level folders first by reversing the list
            for (const foldId of folders.reverse()) {
                try { await pb.collection('folders').delete(foldId); } catch { }
            }
        }
    }
}

export async function restoreFromTrash(items: { type: 'folder' | 'file', id: string }[], userId: string) {
    // Check if "Restored" folder exists at root, create if not
    let restoredFolderId: string | null = null;
    const getRestoredFolder = async () => {
        if (restoredFolderId) return restoredFolderId;
        try {
            const existing = await pb.collection('folders').getFirstListItem(`name = "Restored" && parent = "" && user_id = "${userId}" && is_trash = false`);
            restoredFolderId = existing.id;
            return existing.id;
        } catch {
            const newFolder = await pb.collection('folders').create({
                name: "Restored",
                user_id: userId,
                parent: "",
                is_trash: false
            });
            restoredFolderId = newFolder.id;
            return newFolder.id;
        }
    };

    for (const item of items) {
        const collectionName = item.type === 'folder' ? 'folders' : 'files';
        try {
            const record = await pb.collection(collectionName).getOne(item.id);
            const parentKey = item.type === 'folder' ? 'parent' : 'folder_id';
            const parentId = record[parentKey];

            let targetParent = parentId;
            let needsFallback = false;

            if (parentId) {
                try {
                    const parentData = await pb.collection('folders').getOne(parentId);
                    if (parentData.is_trash) {
                        needsFallback = true;
                    }
                } catch {
                    // Parent doesn't exist anymore
                    needsFallback = true;
                }
            }

            if (needsFallback) {
                targetParent = await getRestoredFolder();
            }

            if (item.type === 'file') {
                await pb.collection('files').update(item.id, { is_trash: false, folder_id: targetParent });
            } else if (item.type === 'folder') {
                // Restore the root folder and move it to targetParent
                await pb.collection('folders').update(item.id, { is_trash: false, parent: targetParent });

                // Recursively restore all its children
                const { folders, files } = await getRecursiveItems(item.id);
                // The root is already restored, so remove it from the list
                const subfolders = folders.filter(id => id !== item.id);
                for (const fId of files) await pb.collection('files').update(fId, { is_trash: false });
                for (const foldId of subfolders) await pb.collection('folders').update(foldId, { is_trash: false });
            }
        } catch (e) {
            console.error("Failed to restore item", item.id, e);
        }
    }
}
