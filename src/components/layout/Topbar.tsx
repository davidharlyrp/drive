import { Search, User, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useSearchStore } from '../../store/useSearchStore';
import { pb } from '../../lib/pb';

interface TopbarProps {
    onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
    const { user } = useAuthStore();
    const { searchQuery, setSearchQuery } = useSearchStore();

    return (
        <header className="h-16 flex items-center justify-between px-6 border-b border-surface-50 bg-white/80 backdrop-blur-md sticky top-0 z-30">
            <div className="flex-1 flex items-center max-w-xl">
                <button
                    className="md:hidden p-2 text-surface-400 hover:text-brand mr-3 transition-colors rounded-lg bg-surface-50"
                    onClick={onMenuClick}
                >
                    <Menu size={18} />
                </button>
                <div className="relative w-full group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-300 group-focus-within:text-brand transition-colors">
                        <Search size={16} />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-surface-50/50 border border-surface-100 text-surface-900 text-sm pl-10 pr-4 py-2 focus:outline-none focus:bg-white focus:ring-4 focus:ring-brand/5 focus:border-brand/40 hover:bg-surface-50 transition-all rounded-xl placeholder-surface-300 shadow-sm"
                        placeholder="Search your library..."
                    />
                </div>
            </div>

            <div className="flex items-center gap-4 ml-6">
                <div className="h-8 w-px bg-surface-100 hidden sm:block"></div>
                <div className="flex items-center gap-2.5">
                    <div className="text-right hidden sm:block">
                        <div className="text-xs font-semibold text-surface-900 truncate max-w-[120px] leading-tight">{user?.name || user?.username}</div>
                    </div>
                    <button className="w-9 h-9 rounded-full bg-white border border-surface-100 flex items-center justify-center text-surface-400 hover:text-brand hover:border-brand transition-all duration-300 shadow-sm active:scale-90 overflow-hidden group">
                        {user?.avatar ? (
                            <img
                                src={pb.files.getURL(user, user.avatar, { thumb: '400x400' })}
                                alt="Avatar"
                                className="w-full h-full object-cover p-0.5 rounded-full group-hover:scale-110 transition-transform"
                            />
                        ) : (
                            <User size={18} />
                        )}
                    </button>
                </div>
            </div>
        </header>
    );
}
