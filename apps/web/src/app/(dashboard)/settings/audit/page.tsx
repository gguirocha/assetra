"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Settings, Users, Shield, ScrollText, Bell, Zap, Server, Search, ChevronLeft, ChevronRight } from 'lucide-react';
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

const ACTION_COLORS: Record<string, string> = { create: '#22c55e', update: '#f59e0b', delete: '#ef4444', login: '#3b82f6', logout: '#6b7280' };

export default function AuditPage() {
    const pathname = usePathname();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterModule, setFilterModule] = useState('all');
    const [filterAction, setFilterAction] = useState('all');
    const [page, setPage] = useState(0);
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    const PER_PAGE = 25;

    const loadLogs = useCallback(async () => {
        setLoading(true);
        let query = supabase.from('audit_logs').select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1);
        if (filterModule !== 'all') query = query.eq('module', filterModule);
        if (filterAction !== 'all') query = query.eq('action', filterAction);
        if (search) query = query.or(`user_name.ilike.%${search}%,entity.ilike.%${search}%,details.ilike.%${search}%`);
        const { data, count } = await query;
        if (data) setLogs(data);
        setLoading(false);
    }, [page, filterModule, filterAction, search]);

    useEffect(() => { loadLogs(); }, [loadLogs]);

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Settings className="w-7 h-7 text-[#00E5FF]" /> Configurações
                </h1>
            </div>
            <div className="flex gap-1 flex-wrap border-b border-white/10 pb-0">
                {TABS.map(tab => (
                    <Link key={tab.href} href={tab.href}
                        className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-all',
                            pathname === tab.href ? 'bg-white/5 text-[#00E5FF] border-b-2 border-[#00E5FF]' : 'text-slate-500 hover:text-slate-300')}>
                        <tab.icon className="w-3.5 h-3.5" />{tab.name}
                    </Link>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap items-center">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                        className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]"
                        placeholder="Buscar nos logs..." />
                </div>
                <select value={filterModule} onChange={e => { setFilterModule(e.target.value); setPage(0); }}
                    className="px-2 py-2 bg-black/30 border border-white/10 rounded text-white text-xs focus:outline-none">
                    <option value="all" className="bg-[#0f0f14]">Todos os módulos</option>
                    {['fleet', 'maintenance', 'inventory', 'fuel', 'carwash', 'admin', 'auth'].map(m =>
                        <option key={m} value={m} className="bg-[#0f0f14]">{m}</option>)}
                </select>
                <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}
                    className="px-2 py-2 bg-black/30 border border-white/10 rounded text-white text-xs focus:outline-none">
                    <option value="all" className="bg-[#0f0f14]">Todas as ações</option>
                    {['create', 'update', 'delete', 'login', 'logout'].map(a =>
                        <option key={a} value={a} className="bg-[#0f0f14]">{a}</option>)}
                </select>
            </div>

            {loading && <p className="text-slate-400 text-center py-8 animate-pulse">Carregando logs...</p>}

            {!loading && (
                <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5 text-slate-400 text-xs">
                                <th className="text-left p-3">Data/Hora</th>
                                <th className="text-left p-3">Usuário</th>
                                <th className="text-center p-3">Ação</th>
                                <th className="text-left p-3">Módulo</th>
                                <th className="text-left p-3">Entidade</th>
                                <th className="text-left p-3">Detalhes</th>
                                <th className="text-left p-3">IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <>
                                    <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                                        <td className="p-3 text-slate-300 font-mono text-[11px]">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                                        <td className="p-3 text-white text-xs">{log.user_name || '-'}</td>
                                        <td className="p-3 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: `${ACTION_COLORS[log.action] || '#6b7280'}20`, color: ACTION_COLORS[log.action] || '#6b7280' }}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-300 text-xs uppercase">{log.module}</td>
                                        <td className="p-3 text-slate-300 text-xs">{log.entity || '-'}</td>
                                        <td className="p-3 text-slate-400 text-xs truncate max-w-[200px]">{log.details || '-'}</td>
                                        <td className="p-3 text-slate-500 font-mono text-[10px]">{log.ip_address || '-'}</td>
                                    </tr>
                                    {expandedLog === log.id && (log.before_data || log.after_data) && (
                                        <tr key={`${log.id}-detail`}>
                                            <td colSpan={7} className="p-3 bg-black/20">
                                                <div className="grid grid-cols-2 gap-4 text-[10px]">
                                                    {log.before_data && (
                                                        <div>
                                                            <span className="text-red-400 font-bold block mb-1">Antes:</span>
                                                            <pre className="text-slate-400 overflow-auto max-h-40 bg-black/30 p-2 rounded font-mono">{JSON.stringify(log.before_data, null, 2)}</pre>
                                                        </div>
                                                    )}
                                                    {log.after_data && (
                                                        <div>
                                                            <span className="text-emerald-400 font-bold block mb-1">Depois:</span>
                                                            <pre className="text-slate-400 overflow-auto max-h-40 bg-black/30 p-2 rounded font-mono">{JSON.stringify(log.after_data, null, 2)}</pre>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                            {logs.length === 0 && (
                                <tr><td colSpan={7} className="text-center text-slate-500 py-8">Nenhum log encontrado.</td></tr>
                            )}
                        </tbody>
                    </table>
                    <div className="flex justify-between items-center p-3 border-t border-white/5">
                        <Button size="sm" variant="ghost" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                            className="text-xs text-slate-400 border border-white/10"><ChevronLeft className="w-3 h-3 mr-1" /> Anterior</Button>
                        <span className="text-xs text-slate-500">Página {page + 1}</span>
                        <Button size="sm" variant="ghost" onClick={() => setPage(page + 1)} disabled={logs.length < PER_PAGE}
                            className="text-xs text-slate-400 border border-white/10">Próxima <ChevronRight className="w-3 h-3 ml-1" /></Button>
                    </div>
                </div>
            )}
        </div>
    );
}
