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
        <div className="min-h-screen bg-mono-950 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm card-container p-6 relative overflow-hidden">
                {/* Decorative subtle gradient */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-army/10 blur-3xl rounded-full pointer-events-none"></div>

                <div className="flex flex-col items-center mb-6 z-10 relative">
                    <div className="w-12 h-12 bg-mono-800 rounded-compact flex items-center justify-center mb-3">
                        <Cloud className="w-6 h-6 text-army" />
                    </div>
                    <h1 className="text-xl font-medium text-white">
                        {isRegistering ? 'Create Account' : 'Welcome Back'}
                    </h1>
                    <p className="text-xs text-mono-400 mt-1">
                        {isRegistering ? 'Sign up to start storing files' : 'Sign in to access your files'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3 relative z-10">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-mono-300 ml-1">Email</label>
                        <input
                            type="email"
                            placeholder="name@example.com"
                            className="input-compact"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-mono-300 ml-1">Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            className="input-compact"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="btn-primary mt-2 group py-2">
                        <span>{isRegistering ? 'Sign Up' : 'Sign In'}</span>
                        <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </form>

                <div className="mt-5 text-center relative z-10">
                    <p className="text-xs text-mono-400">
                        {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
                        <button
                            className="text-army hover:text-army-light transition-colors"
                            onClick={() => setIsRegistering(!isRegistering)}
                        >
                            {isRegistering ? 'Sign in' : 'Create one'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}
