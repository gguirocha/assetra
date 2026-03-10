"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function UpdatePasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            setLoading(false);
            return;
        }

        try {
            // Atualiza a senha simples e puramente pelo Auth do Supabase
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) throw updateError;

            setMessage('Senha redefinida com sucesso!');

            // Desloga o usuário da sessão de recuperação e o manda para a tela de Login
            setTimeout(async () => {
                await supabase.auth.signOut();
                window.location.href = '/login';
            }, 2000);

        } catch (err: any) {
            setError(err.message || 'Erro crítico ao atualizar. Verifique sua conexão.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-transparent flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Ambient Background Effects */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#5B5CFF]/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00E5FF]/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="flex justify-center">
                    <img src="/logo.png" alt="Assetra Logo" className="h-24 w-auto object-contain drop-shadow-[0_0_15px_rgba(0,229,255,0.4)]" />
                </div>
                <h2 className="mt-2 text-center text-3xl font-extrabold text-transparent text-gradient tracking-wide font-orbitron drop-shadow-[0_0_8px_rgba(91,92,255,0.8)]">
                    ASSETRA
                </h2>
                <div className="glass-card py-8 px-4 sm:rounded-2xl sm:px-10 border border-white/5 shadow-2xl relative z-10 mt-8">
                    <form className="space-y-6" onSubmit={handleUpdate}>
                        {error && (
                            <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-md">
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}

                        {message && (
                            <div className="bg-green-500/10 border-l-4 border-[#00E5FF] p-4 rounded-r-md">
                                <p className="text-sm text-[#00E5FF]">{message}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-300">
                                Nova Senha
                            </label>
                            <div className="mt-1">
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-700/50 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF] sm:text-sm bg-slate-900/50 text-slate-100 transition-colors"
                                    placeholder="Mínimo 6 caracteres"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">
                                Confirmar Nova Senha
                            </label>
                            <div className="mt-1">
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-700/50 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF] sm:text-sm bg-slate-900/50 text-slate-100 transition-colors"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2.5 px-4 rounded-md shadow-sm text-sm font-bold text-white bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00E5FF] focus:ring-offset-[#0f0f14] transition-all disabled:opacity-50 glow-primary"
                            >
                                {loading ? 'Salvando...' : 'Salvar Nova Senha'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 text-center">
                        <Link
                            href="/login"
                            className="font-medium text-slate-500 hover:text-slate-300 text-sm transition-colors"
                        >
                            Voltar ao Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
