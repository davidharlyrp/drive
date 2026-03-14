import { X, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react';

export interface DownloadTask {
    id: string;
    name: string;
    status: 'pending' | 'downloading' | 'completed' | 'error';
    error?: string;
}

interface DownloadProgressModalProps {
    tasks: DownloadTask[];
    totalFiles: number;
    onClose: () => void;
}

export function DownloadProgressModal({ tasks, totalFiles, onClose }: DownloadProgressModalProps) {
    if (totalFiles === 0 && tasks.length === 0) return null;

    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const isFinished = completedCount === totalFiles && totalFiles > 0;
    const progress = totalFiles > 0 ? (completedCount / totalFiles) * 100 : 0;

    return (
        <div className="fixed bottom-8 right-8 w-96 z-[100] animate-in slide-in-from-bottom-8 duration-500 flex flex-col pointer-events-auto">
            <div className="bg-white/90 backdrop-blur-xl border border-surface-100 rounded-[2rem] shadow-premium overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-white/40 px-6 py-4 flex items-center justify-between border-b border-surface-100">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isFinished ? 'bg-brand text-white' : 'bg-brand/10 text-brand'}`}>
                            {isFinished ? (
                                <CheckCircle size={18} />
                            ) : (
                                <Download size={18} className={totalFiles > 0 ? "animate-bounce" : ""} />
                            )}
                        </div>
                        <div>
                            <span className="text-sm font-semibold text-surface-900 block">
                                {isFinished ? 'Preparing ZIP Ready' : totalFiles === 0 ? 'Analyzing structure...' : 'Creating ZIP Archive'}
                            </span>
                            <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-normal">
                                {totalFiles > 0 ? `${completedCount} of ${totalFiles} files bundled` : 'Counting files...'}
                            </span>
                        </div>
                    </div>
                    {isFinished && (
                        <button
                            onClick={onClose}
                            className="text-surface-400 hover:text-surface-900 hover:bg-surface-100 p-2 rounded-full transition-all"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="max-h-60 overflow-y-auto p-6 flex flex-col gap-4 custom-scrollbar">
                    {/* Overall Progress */}
                    {totalFiles > 0 && !isFinished && (
                        <div className="mb-2 p-4 bg-surface-50 rounded-2xl border border-surface-100">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-semibold text-surface-900">Total Progress</span>
                                <span className="text-xs font-semibold text-brand">{Math.round(progress)}%</span>
                            </div>
                            <div className="w-full bg-surface-200 h-2 rounded-full overflow-hidden">
                                <div
                                    className="bg-brand h-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {tasks.slice(-5).map((task) => (
                            <div key={task.id} className="flex flex-col gap-1 p-1">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.status === 'completed' ? 'bg-brand' : task.status === 'error' ? 'bg-red-400' : 'bg-brand animate-pulse'}`}></div>
                                        <span className="text-[11px] font-semibold text-surface-600 truncate" title={task.name}>
                                            {task.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {task.status === 'completed' && <CheckCircle size={12} className="text-brand" />}
                                        {task.status === 'error' && <AlertCircle size={12} className="text-red-500" />}
                                        {task.status === 'downloading' && <Loader2 size={12} className="text-brand animate-spin" />}
                                    </div>
                                </div>
                                {task.status === 'error' && (
                                    <span className="text-[9px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full w-fit ml-3">{task.error || 'Failed'}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
