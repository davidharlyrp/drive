import { Search, Bell, User, Menu } from 'lucide-react';

interface TopbarProps {
    onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
    return (
        <header className="h-14 flex items-center justify-between px-4 border-b border-mono-800 bg-mono-900/50 backdrop-blur-md sticky top-0 z-10">
            <div className="flex-1 flex items-center max-w-xl">
                <button
                    className="md:hidden p-2 text-mono-400 hover:text-white mr-2"
                    onClick={onMenuClick}
                >
                    <Menu size={20} />
                </button>
                <div className="relative w-full">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-mono-500">
                        <Search size={16} />
                    </div>
                    <input
                        type="text"
                        className="w-full bg-mono-950 border border-mono-800 text-mono-100 text-sm pl-9 pr-3 py-1.5 focus:outline-none focus:border-army hover:border-mono-700 transition-colors rounded-compact placeholder-mono-600"
                        placeholder="Search files, folders..."
                    />
                </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
                <button className="p-2 text-mono-400 hover:text-white hover:bg-mono-800 rounded-compact transition-colors">
                    <Bell size={18} />
                </button>
                <button className="w-8 h-8 rounded-full bg-mono-800 flex items-center justify-center text-mono-300 hover:text-white hover:bg-mono-700 transition-colors ml-2">
                    <User size={18} />
                </button>
            </div>
        </header>
    );
}
