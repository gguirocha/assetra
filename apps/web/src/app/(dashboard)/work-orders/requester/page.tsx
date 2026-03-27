"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ClipboardList, CheckCircle, Clock, AlertTriangle, MessageSquare, Send, Search, Filter, UserCheck, ClipboardCheck, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
    { name: 'Todas as OS', href: '/work-orders', icon: ClipboardList },
    { name: 'Portal do Técnico', href: '/work-orders/technician', icon: UserCheck },
    { name: 'Portal do Solicitante', href: '/work-orders/requester', icon: ClipboardCheck },
];

export default function RequesterPortalPage() {
    const pathname = usePathname();
    const { session } = useAuth();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');

    // Comment modal
    const [commentModalOpen, setCommentModalOpen] = useState(false);
    const [selectedOS, setSelectedOS] = useState<any>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [sendingComment, setSendingComment] = useState(false);

    // KPIs
    const [kpis, setKpis] = useState({ total: 0, open: 0, in_progress: 0, completed: 0 });

    const fetchOrders = useCallback(async () => {
        if (!session?.user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('work_orders')
                .select(`
                    *,
                    vehicles ( plate, model ),
                    assets_machines ( name, model ),
                    assets_facilities ( name, location ),
                    maintenance_technicians ( name )
                `)
                .eq('requester_id', session.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            const allOrders = data || [];
            setOrders(allOrders);

            setKpis({
                total: allOrders.length,
                open: allOrders.filter(o => o.status === 'aberta').length,
                in_progress: allOrders.filter(o => ['em_atendimento', 'pecas'].includes(o.status)).length,
                completed: allOrders.filter(o => o.status === 'concluida').length
            });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [session]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const openComments = async (os: any) => {
        setSelectedOS(os);
        setCommentModalOpen(true);
        setNewComment('');
        const { data } = await supabase.from('work_order_comments').select('*').eq('work_order_id', os.id).order('created_at', { ascending: true });
        setComments(data || []);
    };

    const sendComment = async () => {
        if (!newComment.trim() || !selectedOS) return;
        setSendingComment(true);
        try {
            let authorName = 'Solicitante';
            if (session?.user) {
                const { data: prof } = await supabase.from('user_profiles').select('name').eq('id', session.user.id).single();
                if (prof?.name) authorName = prof.name;
            }
            await supabase.from('work_order_comments').insert([{
                work_order_id: selectedOS.id, author_name: authorName, author_role: 'solicitante', message: newComment.trim()
            }]);
            setNewComment('');
            const { data } = await supabase.from('work_order_comments').select('*').eq('work_order_id', selectedOS.id).order('created_at', { ascending: true });
            setComments(data || []);
        } catch (e: any) { alert('Erro: ' + e.message); }
        finally { setSendingComment(false); }
    };

    const getAssetLabel = (os: any) => {
        if (os.type === 'vehicle') return os.vehicles?.plate ? `${os.vehicles.plate} - ${os.vehicles.model || ''}` : 'Veículo';
        if (os.type === 'machine') return os.assets_machines?.name || 'Máquina';
        if (os.type === 'facility') return os.assets_facilities?.name || 'Ativo Predial';
        return 'N/A';
    };

    const getTypeLabel = (type: string) => {
        switch (type) { case 'vehicle': return 'Veículo'; case 'machine': return 'Máquina'; case 'facility': return 'Predial'; default: return type; }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'aberta': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
            case 'em_atendimento': return 'bg-blue-500/20 text-[#00E5FF] border-[#00E5FF]/30';
            case 'pecas': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'concluida': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'cancelada': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) { case 'aberta': return 'Aberta'; case 'em_atendimento': return 'Em Atendimento'; case 'pecas': return 'Ag. Peças'; case 'concluida': return 'Concluída'; case 'cancelada': return 'Cancelada'; default: return status; }
    };

    const getCommentStyle = (role: string) => {
        if (role === 'tecnico') return 'bg-[#00E5FF]/10 border-[#00E5FF]/20 ml-8';
        if (role === 'sistema') return 'bg-slate-500/10 border-slate-500/20 mx-4 italic';
        return 'bg-[#5B5CFF]/10 border-[#5B5CFF]/20 mr-8';
    };

    const filteredOrders = orders.filter(os => {
        const matchesSearch = os.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            getAssetLabel(os).toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(os.os_number || '').includes(searchTerm);
        const matchesType = filterType === 'all' || os.type === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <ClipboardCheck className="w-7 h-7 text-[#5B5CFF]" /> Minhas Solicitações
                </h1>
                <p className="text-slate-400 mt-1">Acompanhe o andamento das suas Ordens de Serviço e interaja com a equipe técnica.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 flex-wrap border-b border-white/10 pb-0">
                {TABS.map(tab => (
                    <Link key={tab.href} href={tab.href}
                        className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-all',
                            pathname === tab.href ? 'bg-white/5 text-[#00E5FF] border-b-2 border-[#00E5FF]' : 'text-slate-500 hover:text-slate-300')}>
                        <tab.icon className="w-3.5 h-3.5" />{tab.name}
                    </Link>
                ))}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total de OS</p>
                        <p className="text-2xl font-bold text-white font-mono mt-1">{kpis.total}</p>
                    </div>
                    <div className="w-10 h-10 bg-[#5B5CFF]/20 text-[#5B5CFF] rounded-lg flex items-center justify-center"><ClipboardList className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Abertas</p>
                        <p className="text-2xl font-bold text-yellow-400 font-mono mt-1">{kpis.open}</p>
                    </div>
                    <div className="w-10 h-10 bg-yellow-500/20 text-yellow-500 rounded-lg flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Em Andamento</p>
                        <p className="text-2xl font-bold text-[#00E5FF] font-mono mt-1">{kpis.in_progress}</p>
                    </div>
                    <div className="w-10 h-10 bg-[#00E5FF]/20 text-[#00E5FF] rounded-lg flex items-center justify-center"><Clock className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Concluídas</p>
                        <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{kpis.completed}</p>
                    </div>
                    <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5" /></div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="Buscar por descrição, ativo ou Nº da OS..."
                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 bg-black/20 border-white/10 text-white placeholder:text-slate-500" />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}
                        className="px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]">
                        <option value="all" className="bg-[#0f0f14]">Todos os Tipos</option>
                        <option value="vehicle" className="bg-[#0f0f14]">Veículos</option>
                        <option value="machine" className="bg-[#0f0f14]">Máquinas</option>
                        <option value="facility" className="bg-[#0f0f14]">Predial</option>
                    </select>
                </div>
                <Link href="/work-orders?new=1">
                    <Button size="sm" className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Nova OS
                    </Button>
                </Link>
            </div>

            {/* OS List */}
            <div className="space-y-3">
                {loading ? (
                    <p className="text-slate-400 text-center py-8">Carregando...</p>
                ) : filteredOrders.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">Nenhuma O.S encontrada.</p>
                ) : (
                    filteredOrders.map(os => (
                        <div key={os.id} className="glass-card rounded-xl p-5 hover:border-[#5B5CFF]/20 border border-white/5 transition-all">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <span className="font-mono text-[#00E5FF] text-sm font-bold">OS-{String(os.os_number || '?').padStart(4, '0')}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusStyle(os.status)}`}>{getStatusLabel(os.status)}</span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border bg-slate-500/20 text-slate-400 border-slate-500/30">{getTypeLabel(os.type)}</span>
                                        {os.priority === 'urgente' && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">URGENTE</span>
                                        )}
                                    </div>
                                    <p className="text-white font-medium mb-1 truncate">{os.description}</p>
                                    <div className="flex gap-4 flex-wrap text-[11px] text-slate-500">
                                        <span>Ativo: <span className="text-white">{getAssetLabel(os)}</span></span>
                                        <span>Técnico: <span className="text-[#00E5FF]">{os.maintenance_technicians?.name || 'Não atribuído'}</span></span>
                                    </div>
                                    <div className="flex gap-4 mt-1 text-[11px] text-slate-500">
                                        <span>Aberta em: {new Date(os.opening_date || os.created_at).toLocaleDateString('pt-BR')}</span>
                                        {os.accepted_date && os.status !== 'aberta' && <span className="text-blue-400">Aceita: {new Date(os.accepted_date).toLocaleDateString('pt-BR')}</span>}
                                        {os.status === 'concluida' && os.completion_date && <span className="text-emerald-400">Finalizada: {new Date(os.completion_date).toLocaleDateString('pt-BR')}</span>}
                                    </div>
                                </div>
                                <div className="shrink-0">
                                    <Button size="sm" variant="ghost" onClick={() => openComments(os)} className="text-slate-400 hover:text-white border border-white/10 hover:bg-white/5">
                                        <MessageSquare className="w-3 h-3 mr-1" /> Timeline
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Comments Modal */}
            <Modal isOpen={commentModalOpen} onClose={() => setCommentModalOpen(false)} title={`Timeline — OS-${String(selectedOS?.os_number || '?').padStart(4, '0')}`} size="lg">
                <div className="flex flex-col h-[400px]">
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
                        {comments.length === 0 ? (
                            <p className="text-center text-slate-500 py-8">Nenhuma atualização ainda. Adicione uma mensagem abaixo!</p>
                        ) : (
                            comments.map(c => (
                                <div key={c.id} className={`p-3 rounded-lg border ${getCommentStyle(c.author_role)}`}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-semibold text-white">
                                            {c.author_name} <span className="ml-2 text-[10px] text-slate-500 uppercase">{c.author_role}</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500">{new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.message}</p>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="border-t border-white/10 pt-3 flex gap-2">
                        <Input placeholder="Escreva uma mensagem ou solicite informação..."
                            value={newComment} onChange={e => setNewComment(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
                            className="flex-1 bg-black/20 border-white/10 text-white placeholder:text-slate-500" />
                        <Button onClick={sendComment} disabled={sendingComment || !newComment.trim()}
                            className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 px-4">
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
