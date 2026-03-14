import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export interface UploadTask {
    id: string;
    name: string;
    size: number;
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    error?: string;
}

interface UploadProgressModalProps {
    tasks: UploadTask[];
    onClose: () => void;
}

export function UploadProgressModal({ tasks, onClose }: UploadProgressModalProps) {
    if (tasks.length === 0) return null;

    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const totalCount = tasks.length;
    const isFinished = tasks.every(t => t.status === 'completed' || t.status === 'error');
    const totalProgress = tasks.reduce((acc, t) => acc + t.progress, 0) / tasks.length;

    return (
        <div className="fixed bottom-6 right-6 w-80 z-[100] animate-in slide-in-from-bottom flex flex-col pointer-events-auto">
            <div className="bg-mono-950 border border-mono-800 rounded-compact shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-mono-900 px-4 py-3 flex items-center justify-between border-b border-mono-800">
                    <div className="flex items-center gap-2">
                        {isFinished ? (
                            <CheckCircle size={16} className="text-army" />
                        ) : (
                            <Loader2 size={16} className="text-army animate-spin" />
                        )}
                        <span className="text-sm font-bold text-white">
                            {isFinished ? 'Uploads Completed' : `Uploading (${completedCount}/${totalCount})`}
                        </span>
                    </div>
                    {isFinished && (
                        <button
                            onClick={onClose}
                            className="text-mono-400 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="max-h-60 overflow-y-auto p-3 flex flex-col gap-3">
                    {/* Overall Progress */}
                    {!isFinished && (
                        <div className="mb-2">
                            <div className="flex justify-between text-[10px] text-mono-400 mb-1">
                                <span>Total Progress</span>
                                <span>{Math.round(totalProgress)}%</span>
                            </div>
                            <div className="w-full bg-mono-900 h-1 rounded-full overflow-hidden">
                                <div
                                    className="bg-army h-full transition-all duration-300"
                                    style={{ width: `${totalProgress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {tasks.map((task) => (
                        <div key={task.id} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-xs text-mono-200 truncate flex-1" title={task.name}>
                                    {task.name}
                                </span>
                                {task.status === 'completed' && <CheckCircle size={12} className="text-army shrink-0" />}
                                {task.status === 'error' && <AlertCircle size={12} className="text-red-500 shrink-0" />}
                                {task.status === 'uploading' && <span className="text-[10px] text-mono-400 shrink-0">{Math.round(task.progress)}%</span>}
                            </div>

                            {task.status === 'uploading' && (
                                <div className="w-full bg-mono-900 h-1 rounded-full overflow-hidden">
                                    <div
                                        className="bg-army h-full transition-all duration-300"
                                        style={{ width: `${task.progress}%` }}
                                    />
                                </div>
                            )}

                            {task.status === 'error' && (
                                <span className="text-[10px] text-red-400 truncate">{task.error || 'Failed'}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
