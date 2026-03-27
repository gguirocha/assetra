"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Bell, Search, UserCircle, LogOut, Menu, Moon, Sun, Check, BellRing, X } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface TopbarProps {
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (v: boolean) => void;
}

export function Topbar({ isMobileMenuOpen, setIsMobileMenuOpen }: TopbarProps) {
    const { user, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        }
        if (showNotifications) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showNotifications]);

    // Load notifications
    const loadNotifications = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const { data, count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .limit(20);

        if (data) setNotifications(data);

        // Count unread
        const { count: unread } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('read', false);

        setUnreadCount(unread || 0);
        setLoading(false);
    }, [user]);

    // Load on mount and periodically
    useEffect(() => {
        loadNotifications();
        const interval = setInterval(loadNotifications, 60000); // Every 60s
        return () => clearInterval(interval);
    }, [loadNotifications]);

    const markRead = async (id: string) => {
        await supabase.from('notifications').update({ read: true }).eq('id', id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const markAllRead = async () => {
        await supabase.from('notifications').update({ read: true }).eq('read', false);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'agora';
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        const days = Math.floor(hrs / 24);
        return `${days}d`;
    };

    return (
        <header className="h-16 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 md:px-6 shrink-0 z-10 w-full relative">
            <div className="flex items-center flex-1">
                {/* Mobile Hamburger */}
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 mr-2 text-slate-400 hover:text-white lg:hidden"
                >
                    <Menu className="w-6 h-6" />
                </button>

                <div className="flex items-center bg-slate-900/50 border border-slate-700/50 focus-within:border-[#00E5FF] focus-within:ring-1 focus-within:ring-[#00E5FF] rounded-lg px-3 py-2 w-full max-w-md transition-all glow-secondary hidden sm:flex">
                    <Search className="w-5 h-5 text-slate-400 mr-2" />
                    <input
                        type="text"
                        placeholder="Buscar OS, placa, equipamento..."
                        className="bg-transparent border-none outline-none w-full text-sm text-slate-200 placeholder-slate-500"
                    />
                </div>
            </div>

            <div className="flex items-center space-x-2 md:space-x-4">
                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2 text-slate-400 hover:text-slate-200 transition-colors bg-white/5 rounded-full"
                    title={theme === 'dark' ? "Mudar para Claro" : "Mudar para Escuro"}
                    data-theme-ignore
                >
                    {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-400" />}
                </button>

                {/* Notification Bell with Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) loadNotifications(); }}
                        className="relative p-2 text-slate-400 hover:text-slate-200 transition-colors hidden sm:block"
                    >
                        <Bell className="w-6 h-6" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-0 -right-0 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-[#0a0a0f] flex items-center justify-center">
                                <span className="text-[9px] font-bold text-white leading-none">{unreadCount > 99 ? '99+' : unreadCount}</span>
                            </span>
                        )}
                    </button>

                    {/* Dropdown */}
                    {showNotifications && (
                        <div className="absolute right-0 top-12 w-96 max-h-[480px] bg-[#0f0f18] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50 flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <BellRing className="w-4 h-4 text-[#00E5FF]" />
                                    Notificações
                                    {unreadCount > 0 && (
                                        <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">{unreadCount} nova{unreadCount > 1 ? 's' : ''}</span>
                                    )}
                                </h3>
                                <div className="flex items-center gap-2">
                                    {unreadCount > 0 && (
                                        <button onClick={markAllRead} className="text-[10px] text-[#00E5FF] hover:text-white transition-colors" title="Marcar todas como lidas">
                                            <Check className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* List */}
                            <div className="overflow-y-auto flex-1 overscroll-contain">
                                {loading && notifications.length === 0 && (
                                    <p className="text-slate-500 text-xs text-center py-8 animate-pulse">Carregando...</p>
                                )}
                                {!loading && notifications.length === 0 && (
                                    <div className="text-center py-10">
                                        <Bell className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                                        <p className="text-slate-500 text-xs">Nenhuma notificação</p>
                                    </div>
                                )}
                                {notifications.map(n => (
                                    <div
                                        key={n.id}
                                        onClick={() => { if (!n.read) markRead(n.id); }}
                                        className={cn(
                                            'flex items-start gap-3 px-4 py-3 border-b border-white/5 cursor-pointer transition-all',
                                            n.read ? 'opacity-50 hover:opacity-70' : 'bg-[#00E5FF]/[0.02] hover:bg-[#00E5FF]/[0.05]'
                                        )}
                                    >
                                        <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0',
                                            n.read ? 'bg-slate-600' : 'bg-[#00E5FF] shadow-[0_0_6px_rgba(0,229,255,0.5)]'
                                        )} />
                                        <div className="flex-1 min-w-0">
                                            <p className={cn('text-xs font-medium truncate', n.read ? 'text-slate-400' : 'text-white')}>{n.title}</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                        </div>
                                        <span className="text-[9px] text-slate-600 font-mono shrink-0 mt-0.5">{timeAgo(n.created_at)}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Footer */}
                            <Link
                                href="/settings/notifications"
                                onClick={() => setShowNotifications(false)}
                                className="block text-center px-4 py-2.5 text-[11px] text-[#00E5FF] hover:bg-white/5 transition-colors border-t border-white/5 font-medium shrink-0"
                            >
                                Ver todas as notificações →
                            </Link>
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-2 border-l border-slate-700/50 pl-2 md:pl-4 md:ml-2">
                    <div className="text-right hidden md:block">
                        <p className="text-sm font-medium text-slate-200 truncate max-w-[150px]">{user?.email || 'Admin'}</p>
                        <p className="text-xs text-[#00E5FF]">Gestor</p>
                    </div>
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                        <UserCircle className="w-6 h-6 md:w-7 md:h-7" />
                    </div>
                    <button
                        onClick={() => signOut()}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        title="Sair"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </header>
    );
}
