"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, Droplets, CheckCircle, Clock, AlertTriangle, Calendar } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const washSchema = z.object({
    vehicle_id: z.string().min(1, 'Selecione um veículo'),
    wash_type: z.string().min(1, 'Tipo de lavagem obrigatório'),
    scheduled_date: z.string().min(1, 'Data/hora obrigatória'),
    responsible: z.string().optional(),
    status: z.enum(['agendada', 'em_execucao', 'concluida', 'cancelada']).default('agendada'),
    notes: z.string().optional(),
});

type WashFormValues = z.infer<typeof washSchema>;

export default function CarWashPage() {
    const { session } = useAuth();
    const [schedules, setSchedules] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<WashFormValues>({
        resolver: zodResolver(washSchema) as any,
        defaultValues: { status: 'agendada', wash_type: 'Simples' }
    });

    // KPIs
    const [kpis, setKpis] = useState({ agendadas: 0, em_execucao: 0, concluidas_mes: 0, atrasadas: 0 });

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: sData, error } = await supabase
                .from('car_wash_schedules')
                .select('*, vehicles(plate, model, type)')
                .order('scheduled_date', { ascending: false });
            if (error) throw error;

            const all = sData || [];
            setSchedules(all);

            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

            setKpis({
                agendadas: all.filter(s => s.status === 'agendada').length,
                em_execucao: all.filter(s => s.status === 'em_execucao').length,
                concluidas_mes: all.filter(s => s.status === 'concluida' && new Date(s.completion_date || s.scheduled_date) >= firstDay).length,
                atrasadas: all.filter(s => s.status === 'agendada' && new Date(s.scheduled_date) < now).length
            });

            const { data: vData } = await supabase.from('vehicles').select('id, plate, model, type').eq('status', 'ativo').order('plate');
            if (vData) setVehicles(vData);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const onSubmit = async (data: WashFormValues) => {
        try {
            const payload: any = {
                ...data,
                completion_date: data.status === 'concluida' ? new Date().toISOString() : null
            };

            if (editingId) {
                const { error } = await supabase.from('car_wash_schedules').update(payload).eq('id', editingId);
                if (error) throw error;
            } else {
                let tenant_id = null;
                if (session?.user) {
                    const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                    tenant_id = prof?.tenant_id;
                }
                const { error } = await supabase.from('car_wash_schedules').insert([{ ...payload, tenant_id }]);
                if (error) throw error;
            }
            setIsModalOpen(false);
            setEditingId(null);
            reset();
            fetchData();
        } catch (error: any) {
            alert('Erro ao salvar: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este agendamento?')) return;
        const { error } = await supabase.from('car_wash_schedules').delete().eq('id', id);
        if (error) alert('Erro: ' + error.message);
        else fetchData();
    };

    const quickStatus = async (id: string, status: string) => {
        const update: any = { status };
        if (status === 'concluida') update.completion_date = new Date().toISOString();
        const { error } = await supabase.from('car_wash_schedules').update(update).eq('id', id);
        if (error) alert('Erro: ' + error.message);
        else fetchData();
    };

    const openNewModal = () => {
        setEditingId(null);
        reset({ status: 'agendada', wash_type: 'Simples' });
        setIsModalOpen(true);
    };

    const openEditModal = (s: any) => {
        setEditingId(s.id);
        reset({
            vehicle_id: s.vehicle_id,
            wash_type: s.wash_type || 'Simples',
            scheduled_date: s.scheduled_date ? new Date(s.scheduled_date).toISOString().slice(0, 16) : '',
            responsible: s.responsible || '',
            status: s.status,
            notes: s.notes || '',
        });
        setIsModalOpen(true);
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'agendada': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'em_execucao': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            case 'concluida': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'cancelada': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };
    const getStatusLabel = (s: string) => {
        switch (s) { case 'agendada': return 'Agendada'; case 'em_execucao': return 'Em Execução'; case 'concluida': return 'Concluída'; case 'cancelada': return 'Cancelada'; default: return s; }
    };

    const isOverdue = (s: any) => s.status === 'agendada' && new Date(s.scheduled_date) < new Date();

    const filteredSchedules = schedules.filter(s => {
        const matchSearch = (s.vehicles?.plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.responsible?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.wash_type?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchStatus = filterStatus === 'all' || s.status === filterStatus;
        return matchSearch && matchStatus;
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Droplets className="w-7 h-7 text-[#00E5FF]" /> Lava-Jato Interno
                    </h1>
                    <p className="text-slate-400 mt-1">Agenda de lavagem dos veículos da frota.</p>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Agendadas</p>
                        <p className="text-2xl font-bold text-blue-400 font-mono mt-1">{kpis.agendadas}</p>
                    </div>
                    <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center"><Calendar className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Em Execução</p>
                        <p className="text-2xl font-bold text-amber-400 font-mono mt-1">{kpis.em_execucao}</p>
                    </div>
                    <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Concluídas (Mês)</p>
                        <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{kpis.concluidas_mes}</p>
                    </div>
                    <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Atrasadas</p>
                        <p className="text-2xl font-bold text-red-400 font-mono mt-1">{kpis.atrasadas}</p>
                    </div>
                    <div className="w-10 h-10 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></div>
                </div>
            </div>

            <Card className="glass-card bg-[#0f0f14]/50 border-white/5 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                    <CardTitle className="text-lg font-semibold text-white">Agendamentos</CardTitle>
                    <div className="flex items-center space-x-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-52 bg-black/20 border-white/10 text-white placeholder:text-slate-500" />
                        </div>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]">
                            <option value="all" className="bg-[#0f0f14]">Todos</option>
                            <option value="agendada" className="bg-[#0f0f14]">Agendada</option>
                            <option value="em_execucao" className="bg-[#0f0f14]">Em Execução</option>
                            <option value="concluida" className="bg-[#0f0f14]">Concluída</option>
                            <option value="cancelada" className="bg-[#0f0f14]">Cancelada</option>
                        </select>
                        <Button onClick={openNewModal} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            <Plus className="w-4 h-4 mr-2" /> Agendar
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-black/40">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-400">Veículo</TableHead>
                                <TableHead className="text-slate-400">Tipo</TableHead>
                                <TableHead className="text-slate-400">Data/Hora</TableHead>
                                <TableHead className="text-slate-400">Responsável</TableHead>
                                <TableHead className="text-slate-400">Status</TableHead>
                                <TableHead className="text-right text-slate-400">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Carregando...</TableCell></TableRow>
                            ) : filteredSchedules.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Nenhum agendamento encontrado.</TableCell></TableRow>
                            ) : (
                                filteredSchedules.map(s => (
                                    <TableRow key={s.id} className={`border-white/5 hover:bg-white/[0.02] transition-all ${isOverdue(s) ? 'hover:shadow-[inset_4px_0_0_0_#ef4444]' : 'hover:shadow-[inset_4px_0_0_0_#00E5FF]'}`}>
                                        <TableCell className="font-medium text-white">
                                            {s.vehicles?.plate?.toUpperCase() || 'N/A'}
                                            <div className="text-xs text-slate-500">{s.vehicles?.model}</div>
                                        </TableCell>
                                        <TableCell className="text-slate-300">{s.wash_type}</TableCell>
                                        <TableCell className="text-slate-300">
                                            <div>{new Date(s.scheduled_date).toLocaleDateString('pt-BR')}</div>
                                            <div className="text-xs text-slate-500">{new Date(s.scheduled_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                                            {isOverdue(s) && <span className="text-[10px] text-red-400 font-bold animate-pulse">ATRASADA</span>}
                                        </TableCell>
                                        <TableCell className="text-slate-300">{s.responsible || '-'}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusStyle(s.status)}`}>
                                                {getStatusLabel(s.status)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right space-x-1">
                                            {s.status === 'agendada' && (
                                                <Button variant="ghost" size="sm" onClick={() => quickStatus(s.id, 'em_execucao')} className="text-amber-400 hover:bg-amber-500/10" title="Iniciar">
                                                    <Clock className="w-4 h-4" />
                                                </Button>
                                            )}
                                            {s.status === 'em_execucao' && (
                                                <Button variant="ghost" size="sm" onClick={() => quickStatus(s.id, 'concluida')} className="text-emerald-400 hover:bg-emerald-500/10" title="Concluir">
                                                    <CheckCircle className="w-4 h-4" />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="sm" onClick={() => openEditModal(s)} className="text-[#00E5FF] hover:text-white hover:bg-white/10" title="Editar">
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10" title="Excluir">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Editar Agendamento' : 'Novo Agendamento de Lavagem'}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-300">Veículo *</label>
                            <select {...register('vehicle_id')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]">
                                <option value="" className="bg-[#0f0f14]">Selecione...</option>
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id} className="bg-[#0f0f14]">{v.plate.toUpperCase()} - {v.model} ({v.type})</option>
                                ))}
                            </select>
                            {errors.vehicle_id && <p className="text-red-400 text-xs mt-1">{errors.vehicle_id.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Tipo de Lavagem *</label>
                            <select {...register('wash_type')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]">
                                <option value="Simples" className="bg-[#0f0f14]">Simples (Externa)</option>
                                <option value="Completa" className="bg-[#0f0f14]">Completa (Externa + Interna)</option>
                                <option value="Polimento" className="bg-[#0f0f14]">Polimento</option>
                                <option value="Higienização" className="bg-[#0f0f14]">Higienização Interna</option>
                            </select>
                            {errors.wash_type && <p className="text-red-400 text-xs mt-1">{errors.wash_type.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Data e Hora *</label>
                            <Input type="datetime-local" {...register('scheduled_date')} className="mt-1 bg-black/20 border-white/10 text-white" />
                            {errors.scheduled_date && <p className="text-red-400 text-xs mt-1">{errors.scheduled_date.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Responsável</label>
                            <Input {...register('responsible')} placeholder="Nome do responsável..." className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Status</label>
                            <select {...register('status')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]">
                                <option value="agendada" className="bg-[#0f0f14]">Agendada</option>
                                <option value="em_execucao" className="bg-[#0f0f14]">Em Execução</option>
                                <option value="concluida" className="bg-[#0f0f14]">Concluída</option>
                                <option value="cancelada" className="bg-[#0f0f14]">Cancelada</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300">Observações</label>
                        <textarea {...register('notes')} rows={2} placeholder="Observações opcionais..." className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white placeholder:text-slate-600 focus:outline-none focus:ring-[#00E5FF]" />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="border border-white/10 text-slate-300 hover:bg-white/5">Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            {isSubmitting ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
