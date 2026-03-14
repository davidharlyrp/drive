import { Cloud, HardDrive, Settings, X, Image as ImageIcon, ChevronRight, ChevronDown, Folder } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { pb } from '../../lib/pb';
import type { RecordModel } from 'pocketbase';
import { useAuthStore } from '../../store/useAuthStore';
import { SettingsModal } from '../SettingsModal';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
    const { user, storageUsed, updateStorage } = useAuthStore();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isGalleryExpanded, setIsGalleryExpanded] = useState(false);
    const [mediaFolders, setMediaFolders] = useState<RecordModel[]>([]);
    const location = useLocation();

    useEffect(() => {
        updateStorage();
    }, [updateStorage]);

    useEffect(() => {
        const fetchMediaFolders = async () => {
            if (!user) return;
            try {
                // Fetch only files that are media
                const mediaFiles = await pb.collection('files').getFullList({
                    filter: `user_id = "${user.id}" && is_trash = false && (type ~ "image/" || type ~ "video/")`,
                    fields: 'folder_id'
                });

                const folderIds = [...new Set(mediaFiles.map(f => f.folder_id).filter(id => id))];

                if (folderIds.length === 0) {
                    setMediaFolders([]);
                    return;
                }

                // Chunking the filter if there are many folders to avoid URL length issues
                const folders: RecordModel[] = [];
                for (let i = 0; i < folderIds.length; i += 50) {
                    const chunk = folderIds.slice(i, i + 50);
                    const filter = chunk.map(id => `id = "${id}"`).join(' || ');
                    const res = await pb.collection('folders').getFullList({
                        filter: filter,
                        sort: 'name'
                    });
                    folders.push(...res);
                }

                setMediaFolders(folders.sort((a, b) => a.name.localeCompare(b.name)));
            } catch (err) {
                console.error("Sidebar filter fetch failed", err);
            }
        };

        fetchMediaFolders();
    }, [user]);

    // Expand gallery automatically if we are on a filtered gallery page
    useEffect(() => {
        if (location.pathname === '/gallery') {
            setIsGalleryExpanded(true);
        }
    }, [location.pathname]);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const limit = 15 * 1024 * 1024 * 1024; // 15GB
    const progress = Math.min((storageUsed / limit) * 100, 100);

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <aside className={`
                fixed inset-y-0 left-0 z-50 w-full bg-white border-r border-surface-100 flex flex-col h-full transition-transform duration-300 transform
                md:relative md:translate-x-0 md:w-64 md:z-auto md:block
                ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="h-16 flex items-center justify-between px-6 border-b border-surface-50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-brand rounded-lg shadow-sm shadow-brand/20">
                            <Cloud className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-surface-900 text-base tracking-tight">CloudStore</span>
                    </div>
                    <button
                        className="md:hidden p-2 text-surface-400 hover:text-surface-900 transition-colors bg-surface-50 rounded-lg"
                        onClick={() => setIsOpen(false)}
                    >
                        <X size={18} />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto py-6 px-3.5 space-y-1 custom-scrollbar">
                    <NavItem to="/files/root" icon={<HardDrive size={18} />} label="My Files" />

                    <div className="space-y-1">
                        <button
                            onClick={() => setIsGalleryExpanded(!isGalleryExpanded)}
                            className={`w-full flex items-center justify-between px-4 py-2 text-sm rounded-lg transition-all duration-200 group ${location.pathname === '/gallery' && !location.search
                                ? 'bg-brand text-white shadow-md shadow-brand/20 font-semibold'
                                : 'text-surface-500 hover:bg-surface-50 hover:text-surface-900'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="transition-transform duration-200 group-hover:scale-110">
                                    <ImageIcon size={18} />
                                </span>
                                <span>Gallery</span>
                            </div>
                            {isGalleryExpanded ? <ChevronDown size={14} className="opacity-50" /> : <ChevronRight size={14} className="opacity-50" />}
                        </button>

                        {isGalleryExpanded && (
                            <div className="pl-4 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                <NavLink
                                    to="/gallery"
                                    end
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-4 py-1.5 text-[13px] rounded-lg transition-all ${isActive && !location.search
                                            ? 'text-brand font-bold bg-brand/5'
                                            : 'text-surface-400 hover:text-surface-900 hover:bg-surface-50'
                                        }`
                                    }
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-current opacity-40"></div>
                                    <span>All Media</span>
                                </NavLink>

                                {mediaFolders.map(folder => (
                                    <NavLink
                                        key={folder.id}
                                        to={`/gallery?folder=${folder.id}`}
                                        className={() =>
                                            `flex items-center gap-3 px-4 py-1.5 text-[13px] rounded-lg transition-all ${location.search === `?folder=${folder.id}`
                                                ? 'text-brand font-bold bg-brand/5'
                                                : 'text-surface-400 hover:text-surface-900 hover:bg-surface-50'
                                            }`
                                        }
                                    >
                                        <Folder size={14} className="opacity-40" />
                                        <span className="truncate">{folder.name}</span>
                                    </NavLink>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* <NavItem to="/shared" icon={<Share2 size={18} />} label="Shared" /> */}
                    {/* <NavItem to="/starred" icon={<Star size={18} />} label="Starred" />
                    <NavItem to="/trash" icon={<Trash2 size={18} />} label="Trash" /> */}
                </nav>

                <div className="p-5 border-t border-surface-50 bg-surface-50/30">
                    <div
                        className="flex items-center gap-3 text-surface-500 hover:text-brand cursor-pointer transition-all p-2 rounded-lg hover:bg-white hover:shadow-sm"
                        onClick={() => setIsSettingsOpen(true)}
                    >
                        <Settings size={18} />
                        <span className="text-sm font-medium">Settings</span>
                    </div>
                    <div className="mt-5 bg-white p-3 rounded-xl border border-surface-100 shadow-sm">
                        <div className="flex justify-between text-[10px] mb-1.5 text-surface-400 font-semibold uppercase tracking-widest">
                            <span>Storage</span>
                            <span className="text-surface-900">{formatSize(storageUsed)}</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-brand transition-all duration-1000 ease-out rounded-full"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        <p className="mt-1.5 text-[10px] text-surface-400 text-right">of 15 GB used</p>
                    </div>
                </div>
            </aside>

            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </>
    );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2 text-sm rounded-lg transition-all duration-200 group ${isActive
                    ? 'bg-brand text-white shadow-md shadow-brand/20 font-semibold'
                    : 'text-surface-500 hover:bg-surface-50 hover:text-surface-900'
                }`
            }
        >
            <span className="transition-transform duration-200 group-hover:scale-110">{icon}</span>
            <span>{label}</span>
        </NavLink>
    );
}
