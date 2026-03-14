import { Cloud, HardDrive, Share2, Star, Trash2, Settings, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
    const { storageUsed, updateStorage } = useAuthStore();

    useEffect(() => {
        updateStorage();
    }, [updateStorage]);

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
                fixed inset-y-0 left-0 z-50 w-full bg-mono-900 border-r border-mono-800 flex flex-col h-full transition-transform duration-300 transform
                md:relative md:translate-x-0 md:w-60 md:z-auto md:block
                ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="h-14 flex items-center justify-between px-4 border-b border-mono-800">
                    <div className="flex items-center">
                        <Cloud className="w-5 h-5 text-army mr-2" />
                        <span className="font-semibold text-white tracking-tight">CloudStore</span>
                    </div>
                    <button
                        className="md:hidden p-2 text-mono-400 hover:text-white"
                        onClick={() => setIsOpen(false)}
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
                    <NavItem to="/files/root" icon={<HardDrive size={18} />} label="My Files" />
                    <NavItem to="/shared" icon={<Share2 size={18} />} label="Shared with me" />
                    <NavItem to="/starred" icon={<Star size={18} />} label="Starred" />
                    <NavItem to="/trash" icon={<Trash2 size={18} />} label="Trash" />
                </nav>

                <div className="p-4 border-t border-mono-800">
                    <div className="flex items-center gap-2 text-mono-400 hover:text-white cursor-pointer transition-colors p-2 rounded-compact hover:bg-mono-800">
                        <Settings size={18} />
                        <span className="text-sm">Settings</span>
                    </div>
                    <div className="mt-4">
                        <div className="flex justify-between text-[10px] mb-1.5 text-mono-400 font-medium tracking-wide uppercase">
                            <span>Storage</span>
                            <span>{formatSize(storageUsed)} / 15 GB</span>
                        </div>
                        <div className="h-1.5 w-full bg-mono-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-army transition-all duration-500 rounded-full"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-sm rounded-compact transition-colors ${isActive
                    ? 'bg-mono-800 text-white font-medium'
                    : 'text-mono-300 hover:bg-mono-800 hover:text-white'
                }`
            }
        >
            {icon}
            <span>{label}</span>
        </NavLink>
    );
}
