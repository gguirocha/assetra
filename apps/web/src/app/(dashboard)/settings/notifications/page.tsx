"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Settings, Users, Shield, ScrollText, Bell, Zap, Server, Check, Trash2, BellRing } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
    { name: 'Usuários', href: '/settings', icon: Users },
    { name: 'Roles e Permissões', href: '/settings/roles', icon: Shield },
    { name: 'Auditoria', href: '/settings/audit', icon: ScrollText },
    { name: 'Notificações', href: '/settings/notifications', icon: Bell },
    { name: 'Automações', href: '/settings/automations', icon: Zap },
    { name: 'Sistema', href: '/settings/system', icon: Server },
];

export default function NotificationsPage() {
    const pathname = usePathname();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

    const loadNotifications = useCallback(async () => {
        setLoading(true);
        let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
        if (filter === 'unread') query = query.eq('read', false);
        if (filter === 'read') query = query.eq('read', true);
        const { data } = await query;
        if (data) setNotifications(data);
        setLoading(false);
    }, [filter]);

    useEffect(() => { loadNotifications(); }, [loadNotifications]);

    const markRead = async (id: string) => {
        await supabase.from('notifications').update({ read: true }).eq('id', id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllRead = async () => {
        await supabase.from('notifications').update({ read: true }).eq('read', false);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const deleteNotification = async (id: string) => {
        await supabase.from('notifications').delete().eq('id', id);
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="space-y-4">
            <div><h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2"><Settings className="w-7 h-7 text-[#00E5FF]" /> Configurações</h1></div>
            <div className="flex gap-1 flex-wrap border-b border-white/10 pb-0">
                {TABS.map(tab => (
                    <Link key={tab.href} href={tab.href}
                        className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-all',
                            pathname === tab.href ? 'bg-white/5 text-[#00E5FF] border-b-2 border-[#00E5FF]' : 'text-slate-500 hover:text-slate-300')}>
                        <tab.icon className="w-3.5 h-3.5" />{tab.name}
                    </Link>
                ))}
            </div>

            <div className="flex justify-between items-center gap-3 flex-wrap">
                <div className="flex gap-2">
                    {(['all', 'unread', 'read'] as const).map(f => (
                        <Button key={f} size="sm" variant={filter === f ? 'primary' : 'ghost'}
                            onClick={() => setFilter(f)}
                            className={filter === f ? 'bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] text-white border-0 text-xs' : 'border border-white/10 text-slate-400 text-xs'}>
                            {f === 'all' ? 'Todas' : f === 'unread' ? `Não lidas (${unreadCount})` : 'Lidas'}
                        </Button>
                    ))}
                </div>
                {unreadCount > 0 && (
                    <Button size="sm" variant="ghost" onClick={markAllRead} className="border border-white/10 text-slate-400 text-xs">
                        <Check className="w-3 h-3 mr-1" /> Marcar todas como lidas
                    </Button>
                )}
            </div>

            {loading && <p className="text-slate-400 text-center py-8 animate-pulse">Carregando...</p>}

            {!loading && (
                <div className="space-y-2">
                    {notifications.map(n => (
                        <div key={n.id} className={cn('glass-card rounded-lg border p-4 transition-all flex items-start gap-3',
                            n.read ? 'border-white/5 opacity-60' : 'border-[#00E5FF]/20 bg-[#00E5FF]/[0.02]')}>
                            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                                n.read ? 'bg-slate-700/30' : 'bg-[#00E5FF]/20')}>
                                <BellRing className={cn('w-4 h-4', n.read ? 'text-slate-500' : 'text-[#00E5FF]')} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h4 className={cn('text-sm font-medium', n.read ? 'text-slate-400' : 'text-white')}>{n.title}</h4>
                                    <span className="text-[10px] text-slate-500 font-mono ml-2 flex-shrink-0">{new Date(n.created_at).toLocaleString('pt-BR')}</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">{n.message}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                {!n.read && (
                                    <button onClick={() => markRead(n.id)} className="p-1 rounded hover:bg-white/5 text-[#00E5FF]" title="Marcar como lida">
                                        <Check className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button onClick={() => deleteNotification(n.id)} className="p-1 rounded hover:bg-white/5 text-red-400/50 hover:text-red-400" title="Excluir">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {notifications.length === 0 && <p className="text-slate-500 text-center py-8">Nenhuma notificação.</p>}
                </div>
            )}
        </div>
    );
}
