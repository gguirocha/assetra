"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Wrench, CheckCircle, Clock, Play, MessageSquare, Send, AlertTriangle, Search, ClipboardList, UserCheck, ClipboardCheck } from 'lucide-react';
import { finalizePartsForOS } from '@/components/inventory/PartsUsedPanel';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
    { name: 'Todas as OS', href: '/work-orders', icon: ClipboardList },
    { name: 'Portal do Técnico', href: '/work-orders/technician', icon: UserCheck },
    { name: 'Portal do Solicitante', href: '/work-orders/requester', icon: ClipboardCheck },
];

export default function TechnicianPortalPage() {
    const pathname = usePathname();
    const { session } = useAuth();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Comment modal
    const [commentModalOpen, setCommentModalOpen] = useState(false);
    const [selectedOS, setSelectedOS] = useState<any>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [sendingComment, setSendingComment] = useState(false);

    // KPIs
    const [kpis, setKpis] = useState({ total_assigned: 0, completed_month: 0, avg_hours: 0, pending: 0 });

    const fetchOrders = useCallback(async () => {
        if (!session?.user) return;
        setLoading(true);
        try {
            // Find technician record linked to this user
            const { data: techData } = await supabase.from('maintenance_technicians').select('id').eq('user_id', session.user.id).single();

            let query = supabase.from('work_orders').select(`
                *,
                vehicles ( plate, model ),
                assets_machines ( name, model ),
                assets_facilities ( name, location ),
                maintenance_technicians ( name )
            `).order('created_at', { ascending: false });

            if (techData?.id) {
                query = query.eq('technician_id', techData.id);
            } else {
                // Fallback: also check if requester matches (some orgs use user_id directly)
                query = query.eq('technician_id', session.user.id);
            }

            const { data, error } = await query;
            if (error) throw error;
            const allOrders = data || [];
            setOrders(allOrders);

            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            setKpis({
                total_assigned: allOrders.length,
                completed_month: allOrders.filter(o => o.status === 'concluida' && new Date(o.completion_date || o.updated_at) >= monthStart).length,
                avg_hours: allOrders.filter(o => o.time_spent_hours).length > 0
                    ? Math.round((allOrders.reduce((sum, o) => sum + (o.time_spent_hours || 0), 0) / allOrders.filter(o => o.time_spent_hours).length) * 10) / 10
                    : 0,
                pending: allOrders.filter(o => ['aberta', 'em_atendimento', 'pecas'].includes(o.status)).length,
            });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [session]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const handleStatusChange = async (osId: string, newStatus: string) => {
        try {
            const updates: any = { status: newStatus };
            if (newStatus === 'em_atendimento') updates.accepted_date = new Date().toISOString();
            if (newStatus === 'concluida') updates.completion_date = new Date().toISOString();

            const { error } = await supabase.from('work_orders').update(updates).eq('id', osId);
            if (error) throw error;

            if (newStatus === 'concluida') {
                const order = orders.find(o => o.id === osId);
                if (order) await finalizePartsForOS(osId, order.tenant_id);
            }
            fetchOrders();
        } catch (err: any) {
            alert('Erro: ' + err.message);
        }
    };

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
            let authorName = 'Técnico';
            if (session?.user) {
                const { data: prof } = await supabase.from('user_profiles').select('name').eq('id', session.user.id).single();
                if (prof?.name) authorName = prof.name;
            }
            await supabase.from('work_order_comments').insert([{
                work_order_id: selectedOS.id, author_name: authorName, author_role: 'tecnico', message: newComment.trim()
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

    const filteredOrders = orders.filter(os =>
        os.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getAssetLabel(os).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <UserCheck className="w-7 h-7 text-[#00E5FF]" /> Portal do Técnico
                </h1>
                <p className="text-slate-400 mt-1">Gerencie as OS atribuídas a você. Atualize status e interaja com os solicitantes.</p>
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
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">OS Atribuídas</p>
                        <p className="text-2xl font-bold text-white font-mono mt-1">{kpis.total_assigned}</p>
                    </div>
                    <div className="w-10 h-10 bg-[#5B5CFF]/20 text-[#5B5CFF] rounded-lg flex items-center justify-center"><Wrench className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Concluídas (Mês)</p>
                        <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{kpis.completed_month}</p>
                    </div>
                    <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Tempo Médio (h)</p>
                        <p className="text-2xl font-bold text-[#00E5FF] font-mono mt-1">{kpis.avg_hours}</p>
                    </div>
                    <div className="w-10 h-10 bg-[#00E5FF]/20 text-[#00E5FF] rounded-lg flex items-center justify-center"><Clock className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pendentes</p>
                        <p className="text-2xl font-bold text-yellow-400 font-mono mt-1">{kpis.pending}</p>
                    </div>
                    <div className="w-10 h-10 bg-yellow-500/20 text-yellow-500 rounded-lg flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></div>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Buscar por ativo ou descrição..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 bg-black/20 border-white/10 text-white placeholder:text-slate-500" />
            </div>

            {/* OS List */}
            <div className="space-y-3">
                {loading ? (
                    <p className="text-slate-400 text-center py-8">Carregando...</p>
                ) : filteredOrders.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">Nenhuma OS atribuída a você no momento.</p>
                ) : (
                    filteredOrders.map(os => (
                        <div key={os.id} className="glass-card rounded-xl p-5 hover:border-[#00E5FF]/20 border border-white/5 transition-all">
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
                                        <span>Aberta em: {new Date(os.opening_date || os.created_at).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                    {os.status === 'aberta' && (
                                        <Button size="sm" onClick={() => handleStatusChange(os.id, 'em_atendimento')}
                                            className="bg-blue-500/20 text-[#00E5FF] border border-[#00E5FF]/30 hover:bg-blue-500/30 text-xs">
                                            <Play className="w-3 h-3 mr-1" /> Iniciar
                                        </Button>
                                    )}
                                    {os.status === 'em_atendimento' && (
                                        <Button size="sm" onClick={() => handleStatusChange(os.id, 'concluida')}
                                            className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs">
                                            <CheckCircle className="w-3 h-3 mr-1" /> Concluir
                                        </Button>
                                    )}
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
                            <p className="text-center text-slate-500 py-8">Nenhuma atualização ainda.</p>
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
                        <Input placeholder="Escreva uma mensagem..." value={newComment} onChange={e => setNewComment(e.target.value)}
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
