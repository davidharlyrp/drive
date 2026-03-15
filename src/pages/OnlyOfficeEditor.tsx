import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DocumentEditor } from "@onlyoffice/document-editor-react";
import { Loader2, AlertCircle, ChevronLeft } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export default function OnlyOfficeEditor() {
    const { fileId } = useParams<{ fileId: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [config, setConfig] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const INTEGRATION_SERVER_URL = import.meta.env.VITE_ONLYOFFICE_PROXY_URL || 'http://localhost:3001';

    useEffect(() => {
        async function fetchConfig() {
            try {
                const userName = user?.name || user?.email || 'User';
                const response = await fetch(`${INTEGRATION_SERVER_URL}/config/${fileId}?userName=${encodeURIComponent(userName)}&userId=${user?.id || ''}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch editor configuration');
                }
                const data = await response.json();
                setConfig(data);
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'An error occurred while loading the editor');
            } finally {
                setLoading(false);
            }
        }

        if (fileId) {
            fetchConfig();
        }
    }, [fileId]);

    const onDocumentReady = () => {
        console.log("Document is ready");
    };

    const onLoadComponentError = (_errorCode: number, errorDescription: string) => {
        console.error(errorDescription);
        setError(`Error loading OnlyOffice component: ${errorDescription}`);
    };

    if (loading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-surface-50">
                <Loader2 className="w-12 h-12 text-brand animate-spin mb-4" />
                <p className="text-surface-600 font-medium">Initializing OnlyOffice Editor...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-surface-50 p-6 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6">
                    <AlertCircle size={32} />
                </div>
                <h1 className="text-2xl font-bold text-surface-900 mb-2">Editor Load Failed</h1>
                <p className="text-surface-500 max-w-md mb-8">{error}</p>
                <button
                    onClick={() => navigate(-1)}
                    className="bg-brand text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-dark transition-all active:scale-95 flex items-center gap-2"
                >
                    <ChevronLeft size={20} /> Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface-900">
            <div className="h-12 bg-white flex items-center px-4 border-b border-surface-200 justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => window.close()}
                        className="p-1.5 hover:bg-surface-100 rounded-lg text-surface-500 transition-colors"
                        title="Close Editor"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <span className="font-bold text-surface-900 truncate max-w-[300px]">
                        {config.document.title}
                    </span>
                </div>
            </div>
            <div className="flex-1 relative">
                <DocumentEditor
                    id="docxEditor"
                    documentServerUrl={config.documentServerUrl}
                    config={config}
                    events_onDocumentReady={onDocumentReady}
                    onLoadComponentError={onLoadComponentError}
                />
            </div>
        </div>
    );
}
