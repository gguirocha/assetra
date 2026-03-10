"use client";

import { useAuth } from '@/contexts/AuthContext';
import { Bell, Search, UserCircle, LogOut } from 'lucide-react';

export function Topbar() {
    const { user, signOut } = useAuth();

    return (
        <header className="h-16 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-10 w-full relative">
            <div className="flex items-center bg-slate-900/50 border border-slate-700/50 focus-within:border-[#00E5FF] focus-within:ring-1 focus-within:ring-[#00E5FF] rounded-lg px-3 py-2 w-96 transition-all glow-secondary">
                <Search className="w-5 h-5 text-slate-400 mr-2" />
                <input
                    type="text"
                    placeholder="Buscar OS, placa, equipamento..."
                    className="bg-transparent border-none outline-none w-full text-sm text-slate-200 placeholder-slate-500"
                />
            </div>

            <div className="flex items-center space-x-4">
                <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
                    <Bell className="w-6 h-6" />
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                </button>

                <div className="flex items-center space-x-2 border-l border-slate-700 pl-4 ml-2">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-slate-200">{user?.email || 'Admin'}</p>
                        <p className="text-xs text-[#00E5FF]">Gestor</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                        <UserCircle className="w-7 h-7" />
                    </div>
                    <button
                        onClick={() => signOut()}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors ml-2"
                        title="Sair"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </header>
    );
}
