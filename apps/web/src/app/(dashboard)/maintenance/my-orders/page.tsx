"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Wrench, CheckCircle, Clock, Play, MessageSquare, Send, AlertTriangle, Search } from 'lucide-react';
import { finalizePartsForOS } from '@/components/inventory/PartsUsedPanel';
import { useForm } from 'react-hook-form';

export default function TechnicianPortalPage() {
    const { session } = useAuth();
    const [orders, setOrders] = useState<any[]>([]);
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [selectedTechId, setSelectedTechId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Comment modal
    const [commentModalOpen, setCommentModalOpen] = useState(false);
    const [selectedOS, setSelectedOS] = useState<any>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [sendingComment, setSendingComment] = useState(false);

    // KPIs
    const [kpis, setKpis] = useState({
        total_assigned: 0,
        completed_month: 0,
        avg_hours: 0,
        pending: 0
    });

    const fetchTechnicians = async () => {
        const { data } = await supabase.from('maintenance_technicians').select('id, name').eq('active', true).order('name');
        if (data) setTechnicians(data);
    };

    const fetchOrders = async (techId: string) => {
        if (!techId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('work_orders')
                .select(`
                    *,
                    vehicles ( plate, model ),
                    assets_machines ( name, model ),
                    assets_facilities ( name, location )
                `)
                .eq('technician_id', techId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            const allOrders = data || [];
            setOrders(allOrders);

            // KPIs
            const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
            const completedMonth = allOrders.filter(o => o.status === 'concluida' && o.completion_date && new Date(o.completion_date) >= new Date(firstDay));
            const totalHours = completedMonth.reduce((acc, o) => acc + (Number(o.time_spent_hours) || 0), 0);
            const pending = allOrders.filter(o => ['aberta', 'em_atendimento', 'pecas'].includes(o.status));

            setKpis({
                total_assigned: allOrders.length,
                completed_month: completedMonth.length,
                avg_hours: completedMonth.length > 0 ? totalHours / completedMonth.length : 0,
                pending: pending.length
            });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTechnicians();
    }, []);

    useEffect(() => {
        if (selectedTechId) fetchOrders(selectedTechId);
    }, [selectedTechId]);

    const acceptOS = async (os: any) => {
        try {
            const { error } = await supabase.from('work_orders').update({
                status: 'em_atendimento',
                accepted_date: new Date().toISOString(),
                start_date: new Date().toISOString()
            }).eq('id', os.id);
            if (error) throw error;

            // Auto-comment
            const tech = technicians.find(t => t.id === selectedTechId);
            await supabase.from('work_order_comments').insert([{
                work_order_id: os.id,
                author_name: tech?.name || 'Técnico',
                author_role: 'tecnico',
                message: '✅ O.S aceita pelo técnico. Atendimento iniciado.'
            }]);

            fetchOrders(selectedTechId);
        } catch (error: any) {
            alert('Erro: ' + error.message);
        }
    };

    const finalizeOS = async (os: any) => {
        const now = new Date();
        const opening = new Date(os.opening_date || os.created_at);
        const accepted = os.accepted_date ? new Date(os.accepted_date) : opening;
        const hoursTotal = Math.round(((now.getTime() - opening.getTime()) / (1000 * 60 * 60)) * 100) / 100;
        const hoursService = Math.round(((now.getTime() - accepted.getTime()) / (1000 * 60 * 60)) * 100) / 100;

        try {
            const { error } = await supabase.from('work_orders').update({
                status: 'concluida',
                completion_date: now.toISOString(),
                time_spent_hours: hoursService
            }).eq('id', os.id);
            if (error) throw error;

            const tech = technicians.find(t => t.id === selectedTechId);
            await supabase.from('work_order_comments').insert([{
                work_order_id: os.id,
                author_name: tech?.name || 'Técnico',
                author_role: 'tecnico',
                message: `🏁 O.S finalizada pelo técnico. Tempo total: ${hoursTotal.toFixed(1)}h | Tempo de atendimento: ${hoursService.toFixed(1)}h`
            }]);

            // Finalize parts: deduct reserved stock and create stock movements
            let tenantId = null;
            if (session?.user) {
                const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                tenantId = prof?.tenant_id;
            }
            await finalizePartsForOS(os.id, tenantId);

            fetchOrders(selectedTechId);
        } catch (error: any) {
            alert('Erro: ' + error.message);
        }
    };

    // Comments
    const openComments = async (os: any) => {
        setSelectedOS(os);
        setCommentModalOpen(true);
        setNewComment('');
        const { data } = await supabase
            .from('work_order_comments')
            .select('*')
            .eq('work_order_id', os.id)
            .order('created_at', { ascending: true });
        setComments(data || []);
    };

    const sendComment = async () => {
        if (!newComment.trim() || !selectedOS) return;
        setSendingComment(true);
        try {
            const tech = technicians.find(t => t.id === selectedTechId);
            await supabase.from('work_order_comments').insert([{
                work_order_id: selectedOS.id,
                author_name: tech?.name || 'Técnico',
                author_role: 'tecnico',
                message: newComment.trim()
            }]);
            setNewComment('');
            // Refresh
            const { data } = await supabase
                .from('work_order_comments')
                .select('*')
                .eq('work_order_id', selectedOS.id)
                .order('created_at', { ascending: true });
            setComments(data || []);
        } catch (e: any) {
            alert('Erro ao enviar: ' + e.message);
        } finally {
            setSendingComment(false);
        }
    };

    const getAssetLabel = (os: any) => {
        if (os.type === 'vehicle') return os.vehicles?.plate ? `${os.vehicles.plate} - ${os.vehicles.model || ''}` : 'Veículo';
        if (os.type === 'machine') return os.assets_machines?.name || 'Máquina';
        if (os.type === 'facility') return os.assets_facilities?.name || 'Ativo Predial';
        return 'N/A';
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

    const getCommentStyle = (role: string) => {
        if (role === 'tecnico') return 'bg-[#00E5FF]/10 border-[#00E5FF]/20 ml-8';
        if (role === 'sistema') return 'bg-slate-500/10 border-slate-500/20 mx-4 italic';
        return 'bg-[#5B5CFF]/10 border-[#5B5CFF]/20 mr-8';
    };

    const filteredOrders = orders.filter(os =>
        os.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getAssetLabel(os).toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(os.os_number || '').includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Portal do Técnico</h1>
                    <p className="text-slate-400 mt-1">Visualize suas O.S, aceite, finalize e acompanhe pelo timeline.</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-sm text-slate-400">Técnico:</label>
                    <select
                        value={selectedTechId}
                        onChange={(e) => setSelectedTechId(e.target.value)}
                        className="px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF] min-w-[200px]"
                    >
                        <option value="" className="bg-[#0f0f14]">Selecione seu nome...</option>
                        {technicians.map(t => (
                            <option key={t.id} value={t.id} className="bg-[#0f0f14]">{t.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {selectedTechId && (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                            <div>
                                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">OS Atribuídas</p>
                                <p className="text-2xl font-bold text-white font-mono mt-1">{kpis.total_assigned}</p>
                            </div>
                            <div className="w-10 h-10 bg-[#5B5CFF]/20 text-[#5B5CFF] rounded-lg flex items-center justify-center">
                                <Wrench className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                            <div>
                                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pendentes</p>
                                <p className="text-2xl font-bold text-amber-400 font-mono mt-1">{kpis.pending}</p>
                            </div>
                            <div className="w-10 h-10 bg-amber-500/20 text-amber-500 rounded-lg flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                            <div>
                                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Concluídas (Mês)</p>
                                <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{kpis.completed_month}</p>
                            </div>
                            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center">
                                <CheckCircle className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                            <div>
                                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Tempo Médio</p>
                                <p className="text-2xl font-bold text-[#00E5FF] font-mono mt-1">{kpis.avg_hours.toFixed(1)}h</p>
                            </div>
                            <div className="w-10 h-10 bg-[#00E5FF]/20 text-[#00E5FF] rounded-lg flex items-center justify-center">
                                <Clock className="w-5 h-5" />
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por descrição, ativo ou Nº da OS..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-black/20 border-white/10 text-white placeholder:text-slate-500"
                        />
                    </div>

                    {/* OS Cards */}
                    <div className="space-y-4">
                        {loading ? (
                            <p className="text-slate-400 text-center py-8">Carregando...</p>
                        ) : filteredOrders.length === 0 ? (
                            <p className="text-slate-400 text-center py-8">Nenhuma O.S encontrada para este técnico.</p>
                        ) : (
                            filteredOrders.map(os => (
                                <div key={os.id} className="glass-card rounded-xl p-5 hover:border-[#00E5FF]/20 border border-white/5 transition-all">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="font-mono text-[#00E5FF] text-sm font-bold">OS-{String(os.os_number || '?').padStart(4, '0')}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusStyle(os.status)}`}>
                                                    {os.status?.replace('_', ' ')}
                                                </span>
                                                <span className="text-[10px] text-slate-500 uppercase tracking-wider">{os.type}</span>
                                            </div>
                                            <p className="text-white font-medium mb-1 truncate">{os.description}</p>
                                            <p className="text-slate-400 text-xs">Ativo: <span className="text-white">{getAssetLabel(os)}</span></p>
                                            <div className="flex gap-4 mt-2 text-[11px] text-slate-500">
                                                <span>Criada: {new Date(os.opening_date || os.created_at).toLocaleDateString('pt-BR')}</span>
                                                {os.accepted_date && os.status !== 'aberta' && <span className="text-[#00E5FF]">Aceita: {new Date(os.accepted_date).toLocaleDateString('pt-BR')}</span>}
                                                {os.status === 'concluida' && os.completion_date && <span className="text-emerald-400">Finalizada: {new Date(os.completion_date).toLocaleDateString('pt-BR')}</span>}
                                                {os.status === 'concluida' && os.time_spent_hours > 0 && <span className="text-amber-400">Tempo: {os.time_spent_hours}h</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            {os.status === 'aberta' && (
                                                <Button size="sm" onClick={() => acceptOS(os)} className="bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30 hover:bg-[#00E5FF]/30">
                                                    <Play className="w-3 h-3 mr-1" /> Aceitar
                                                </Button>
                                            )}
                                            {(os.status === 'em_atendimento' || os.status === 'pecas') && (
                                                <Button size="sm" onClick={() => finalizeOS(os)} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
                                                    <CheckCircle className="w-3 h-3 mr-1" /> Finalizar
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
                </>
            )}

            {/* Comments Modal */}
            <Modal isOpen={commentModalOpen} onClose={() => setCommentModalOpen(false)} title={`Timeline — OS-${String(selectedOS?.os_number || '?').padStart(4, '0')}`} size="lg">
                <div className="flex flex-col h-[400px]">
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
                        {comments.length === 0 ? (
                            <p className="text-center text-slate-500 py-8">Nenhuma atualização ainda. Seja o primeiro a comentar!</p>
                        ) : (
                            comments.map(c => (
                                <div key={c.id} className={`p-3 rounded-lg border ${getCommentStyle(c.author_role)}`}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-semibold text-white">
                                            {c.author_name}
                                            <span className="ml-2 text-[10px] text-slate-500 uppercase">{c.author_role}</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                            {new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.message}</p>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="border-t border-white/10 pt-3 flex gap-2">
                        <Input
                            placeholder="Escreva uma atualização..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
                            className="flex-1 bg-black/20 border-white/10 text-white placeholder:text-slate-500"
                        />
                        <Button onClick={sendComment} disabled={sendingComment || !newComment.trim()} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 px-4">
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
