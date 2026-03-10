"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Truck } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (data.user) {
                // Redireciona direto para o sistema
                window.location.href = '/';
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-transparent flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">

            {/* Ambient Background Effects */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#5B5CFF]/10 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00E5FF]/10 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="flex justify-center mb-6">
                    <img src="/logo.png" alt="Assetra Logo" className="h-24 w-auto object-contain drop-shadow-[0_0_15px_rgba(0,229,255,0.4)]" />
                </div>
                <h2 className="mt-2 text-center text-3xl font-extrabold text-transparent text-gradient tracking-wide font-orbitron drop-shadow-[0_0_8px_rgba(91,92,255,0.8)]">
                    ASSETRA
                </h2>
                <p className="mt-2 text-center text-sm text-slate-400">
                    Gestão inteligente de Frotas e Facilities
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="glass-card py-8 px-4 sm:rounded-2xl sm:px-10 border border-white/5 shadow-2xl relative overflow-hidden">
                    <form className="space-y-6 relative z-10" onSubmit={handleLogin}>
                        {error && (
                            <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-md">
                                <div className="flex">
                                    <div className="ml-3">
                                        <p className="text-sm text-red-400">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-300">
                                E-mail
                            </label>
                            <div className="mt-1">
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-700/50 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF] sm:text-sm bg-slate-900/50 text-slate-100 transition-colors"
                                    placeholder="admin@local.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">
                                Senha
                            </label>
                            <div className="mt-1">
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-700/50 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF] sm:text-sm bg-slate-900/50 text-slate-100 transition-colors"
                                    placeholder="********"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="text-sm">
                                <Link
                                    href="/reset-password"
                                    className="font-medium text-[#00E5FF] hover:text-[#5B5CFF] transition-colors"
                                >
                                    Esqueceu sua senha?
                                </Link>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2.5 px-4 rounded-md shadow-sm text-sm font-bold text-white bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00E5FF] focus:ring-offset-[#0f0f14] transition-all disabled:opacity-50 glow-primary"
                            >
                                {loading ? 'Entrando...' : 'Entrar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
