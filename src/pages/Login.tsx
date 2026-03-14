import { useState } from 'react';
import { Cloud, ArrowRight } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { pb } from '../lib/pb';

export default function Login() {
    const { isAuthenticated, setUser } = useAuthStore();
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    if (isAuthenticated) {
        return <Navigate to="/files/root" replace />;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isRegistering) {
                await pb.collection('users').create({
                    email,
                    password,
                    passwordConfirm: password,
                });
            }
            const authData = await pb.collection('users').authWithPassword(email, password);
            setUser(authData.record, authData.token);
        } catch (err: any) {
            console.error("Auth Error", err);
            alert(err.message || 'Authentication failed');
        }
    };

    return (
        <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-[400px] bg-white border border-surface-100 p-8 rounded-2xl shadow-premium relative overflow-hidden">
                {/* Decorative subtle gradient */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand/5 blur-3xl rounded-full pointer-events-none"></div>

                <div className="flex flex-col items-center mb-8 z-10 relative">
                    <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 border border-indigo-100 shadow-sm">
                        <Cloud className="w-7 h-7 text-brand" />
                    </div>
                    <h1 className="text-xl font-bold text-surface-900">
                        {isRegistering ? 'Create Account' : 'Welcome Back'}
                    </h1>
                    <p className="text-sm font-medium text-surface-400 mt-1">
                        {isRegistering ? 'Sign up to start storing files' : 'Sign in to access your files'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5 relative z-10">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-surface-700 ml-1">Email</label>
                        <input
                            type="email"
                            placeholder="name@example.com"
                            className="w-full bg-surface-50 border border-surface-200 text-surface-900 text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 transition-all placeholder-surface-300 font-medium"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-surface-700 ml-1">Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            className="w-full bg-surface-50 border border-surface-200 text-surface-900 text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 transition-all placeholder-surface-300 font-medium"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="w-full bg-brand hover:shadow-lg hover:shadow-brand/20 text-white py-3.5 px-6 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 mt-2">
                        <span>{isRegistering ? 'Sign Up' : 'Sign In'}</span>
                        <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </form>

                <div className="mt-8 text-center relative z-10 border-t border-surface-50 pt-6">
                    <p className="text-sm font-medium text-surface-500">
                        {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
                        <button
                            className="text-brand font-bold hover:underline transition-colors"
                            onClick={() => setIsRegistering(!isRegistering)}
                        >
                            {isRegistering ? 'Sign in' : 'Create one'}
                        </button>
                    </p>
                </div>
            </div>

            <p className="mt-8 text-[11px] font-bold font-mono text-surface-400 uppercase tracking-wider">
                Daharin Cloud Drive &copy; 2026
            </p>
        </div>
    );
}
