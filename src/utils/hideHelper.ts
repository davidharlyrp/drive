import { pb } from '../lib/pb';
import { getRecursiveItems } from './trashHelper';

export async function toggleHidden(items: { type: 'folder' | 'file', id: string }[], hidden: boolean, userId: string) {
    for (const item of items) {
        if (item.type === 'file') {
            await pb.collection('files').update(item.id, { is_hidden: hidden });

            // If unhiding, recursively unhide parents (folders only)
            if (!hidden) {
                await unhideParents(item.id, 'file');
            }
        } else if (item.type === 'folder') {
            const { folders, files } = await getRecursiveItems(item.id, userId);

            // Parallel updates for files and folders (recursive hide)
            const fileUpdates = files.map(fId =>
                pb.collection('files').update(fId, { is_hidden: hidden }).catch(e =>
                    console.error(`Failed to update hidden status for file ${fId}`, e)
                )
            );

            const folderUpdates = folders.map(foldId =>
                pb.collection('folders').update(foldId, { is_hidden: hidden }).catch(e =>
                    console.error(`Failed to update hidden status for folder ${foldId}`, e)
                )
            );

            await Promise.all([...fileUpdates, ...folderUpdates]);

            // If unhiding, recursively unhide parents (folders only)
            if (!hidden) {
                await unhideParents(item.id, 'folder');
            }
        }
    }
}

async function unhideParents(itemId: string, type: 'file' | 'folder') {
    try {
        let currentId: string | null = null;

        if (type === 'file') {
            const file = await pb.collection('files').getOne(itemId);
            currentId = file.folder_id;
        } else {
            const folder = await pb.collection('folders').getOne(itemId);
            currentId = folder.parent;
        }

        while (currentId) {
            const parent = await pb.collection('folders').getOne(currentId);
            if (parent.is_hidden) {
                await pb.collection('folders').update(currentId, { is_hidden: false });
            }
            currentId = parent.parent;
        }
    } catch (e) {
        console.error("Failed to unhide parents", e);
    }
}
