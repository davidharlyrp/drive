import JSZip from 'jszip';
import { pb } from '../lib/pb';
import type { RecordModel } from 'pocketbase';

export interface DownloadTask {
    id: string;
    name: string;
    status: 'pending' | 'downloading' | 'completed' | 'error';
    error?: string;
}

// Helper for fetching with retry
const fetchWithRetry = async (url: string, retries = 3, delay = 1000): Promise<Response> => {
    // Ensure the URL is properly encoded for spaces and special characters
    const encodedUrl = encodeURI(url);

    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(encodedUrl, {
                mode: 'cors',
                credentials: 'omit', // We pass token in URL
                headers: {
                    'Accept': '*/*',
                }
            });
            if (res.ok) return res;
            if (res.status === 404) throw new Error('File not found');
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        } catch (err: any) {
            if (i === retries - 1) throw err;
            console.warn(`Retry ${i + 1}/${retries} for ${encodedUrl}: ${err.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('All retries failed');
};

export const downloadItemsAsZip = async (
    items: { type: 'folder' | 'file', id: string, name: string }[],
    zipName: string = 'archive.zip',
    onProgress?: (total: number, tasks: DownloadTask[]) => void
) => {
    const zip = new JSZip();
    let totalFiles = 0;
    const tasks: DownloadTask[] = [];

    const updateProgress = () => {
        if (onProgress) onProgress(totalFiles, [...tasks]);
    };

    // Phase 1: Count total files recursively
    const countFiles = async (folderId: string) => {
        const [children, files] = await Promise.all([
            pb.collection('folders').getFullList({ filter: `parent = "${folderId}" && is_trash = false` }),
            pb.collection('files').getFullList({ filter: `folder_id = "${folderId}" && is_trash = false` })
        ]);
        totalFiles += files.length;
        for (const child of children) {
            await countFiles(child.id);
        }
    };

    updateProgress(); // Initial broadcast

    for (const item of items) {
        if (item.type === 'file') totalFiles++;
        else if (item.type === 'folder') await countFiles(item.id);
    }

    updateProgress(); // Broadcast after counting

    // Phase 2: Download and Zip
    const addFolderToZip = async (folderId: string, currentZipFolder: JSZip) => {
        const [children, files] = await Promise.all([
            pb.collection('folders').getFullList({ filter: `parent = "${folderId}" && is_trash = false` }),
            pb.collection('files').getFullList({ filter: `folder_id = "${folderId}" && is_trash = false` })
        ]);

        for (const file of files) {
            const task: DownloadTask = { id: file.id, name: file.name, status: 'downloading' };
            tasks.push(task);
            updateProgress();

            try {
                // Add token for authenticated access
                const url = pb.files.getURL(file, file.file, { token: pb.authStore.token });
                const res = await fetchWithRetry(url);
                const blob = await res.blob();
                currentZipFolder.file(file.name, blob);
                task.status = 'completed';
            } catch (err: any) {
                console.error(`Failed to download file "${file.name}":`, err);
                task.status = 'error';
                task.error = err.message;
            }
            updateProgress();
        }

        for (const child of children) {
            const subZipFolder = currentZipFolder.folder(child.name);
            if (subZipFolder) {
                await addFolderToZip(child.id, subZipFolder);
            }
        }
    };

    for (const item of items) {
        if (item.type === 'file') {
            const task: DownloadTask = { id: item.id, name: item.name, status: 'downloading' };
            tasks.push(task);
            updateProgress();

            try {
                const fileRec = await pb.collection('files').getOne(item.id);
                const url = pb.files.getURL(fileRec, fileRec.file, { token: pb.authStore.token });
                const res = await fetchWithRetry(url);
                const blob = await res.blob();
                zip.file(fileRec.name, blob);
                task.status = 'completed';
            } catch (err: any) {
                console.error(`Failed to download individual file "${item.name}":`, err);
                task.status = 'error';
                task.error = err.message;
            }
            updateProgress();
        } else if (item.type === 'folder') {
            const folderZip = zip.folder(item.name);
            if (folderZip) {
                await addFolderToZip(item.id, folderZip);
            }
        }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = window.URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
};

export const downloadSingleFile = async (file: RecordModel) => {
    const url = pb.files.getURL(file, file.file, { token: pb.authStore.token });
    const res = await fetchWithRetry(url);
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
};

