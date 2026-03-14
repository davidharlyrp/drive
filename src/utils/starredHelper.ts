import { pb } from '../lib/pb';
import { getRecursiveItems } from './trashHelper';

export async function toggleStarred(items: { type: 'folder' | 'file', id: string }[], starred: boolean, userId: string) {
    for (const item of items) {
        if (item.type === 'file') {
            await pb.collection('files').update(item.id, { is_starred: starred });
        } else if (item.type === 'folder') {
            const { folders, files } = await getRecursiveItems(item.id, userId);

            // Sequential updates to avoid large batch failures
            for (const fId of files) {
                try {
                    await pb.collection('files').update(fId, { is_starred: starred });
                } catch (e) {
                    console.error(`Failed to update starred status for file ${fId}`, e);
                }
            }

            for (const foldId of folders) {
                try {
                    await pb.collection('folders').update(foldId, { is_starred: starred });
                } catch (e) {
                    console.error(`Failed to update starred status for folder ${foldId}`, e);
                }
            }
        }
    }
}
