"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, Users, Wrench, Clock, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const technicianSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    contact: z.string().optional(),
    specialties: z.string().min(1, 'Informe pelo menos uma especialidade'),
    hourly_cost: z.coerce.number().min(0).default(0),
    work_schedule: z.string().default('Seg-Sex, 08h as 18h'),
    max_active_os: z.coerce.number().min(1).default(5),
    service_types: z.array(z.string()).default(['vehicle', 'machine', 'facility']),
    active: z.boolean().default(true)
});

const SERVICE_TYPE_OPTIONS = [
    { value: 'vehicle', label: 'Veículos', emoji: '🚗' },
    { value: 'machine', label: 'Máquinas', emoji: '⚙️' },
    { value: 'facility', label: 'Predial', emoji: '🏢' },
];

type TechFormValues = z.infer<typeof technicianSchema>;

export default function TeamManagementPage() {
    const { session } = useAuth();
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [kpis, setKpis] = useState({ total_techs: 0, completed_os: 0, avg_time: 0 });
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<TechFormValues>({
        resolver: zodResolver(technicianSchema) as any,
        defaultValues: { active: true, hourly_cost: 0, max_active_os: 5, work_schedule: 'Seg-Sex, 08h as 18h', service_types: ['vehicle', 'machine', 'facility'] }
    });

    const watchedServiceTypes = watch('service_types');

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Technicians
            const { data: techData, error: techError } = await supabase
                .from('maintenance_technicians')
                .select('*')
                .order('name', { ascending: true });

            if (techError) throw techError;

            // Fetch OS for KPIs (Completed this month)
            const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
            const { data: osData, error: osError } = await supabase
                .from('work_orders')
                .select('id, completion_date, time_spent_hours, technician_id')
                .eq('status', 'concluida')
                .gte('completion_date', firstDayOfMonth);

            if (osError) throw osError;

            const completedOS = osData || [];
            const totalHours = completedOS.reduce((acc, os) => acc + (Number(os.time_spent_hours) || 0), 0);
            const avgTime = completedOS.length > 0 ? (totalHours / completedOS.length) : 0;

            // Enrich technicians with their completed OS count
            const enrichedTechs = (techData || []).map(tech => {
                const techOS = completedOS.filter(os => os.technician_id === tech.id);
                return {
                    ...tech,
                    completed_os_count: techOS.length,
                    total_hours_spent: techOS.reduce((acc, os) => acc + (Number(os.time_spent_hours) || 0), 0)
                };
            });

            setTechnicians(enrichedTechs);
            setKpis({
                total_techs: enrichedTechs.filter(t => t.active).length,
                completed_os: completedOS.length,
                avg_time: avgTime
            });

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onSubmit = async (data: TechFormValues) => {
        try {
            if (editingId) {
                const { error } = await supabase.from('maintenance_technicians').update(data).eq('id', editingId);
                if (error) throw error;
            } else {
                let tenant_id = null;
                if (session?.user) {
                    const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                    tenant_id = prof?.tenant_id;
                }
                const { error } = await supabase.from('maintenance_technicians').insert([{ ...data, tenant_id }]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingId(null);
            reset();
            fetchData();
        } catch (error: any) {
            alert('Erro ao salvar técnico: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este técnico? Ele será desvinculado de todas as O.S abertas!')) return;
        const { error } = await supabase.from('maintenance_technicians').delete().eq('id', id);
        if (error) alert('Erro ao excluir: ' + error.message);
        else fetchData();
    };

    const openNewModal = () => {
        setEditingId(null);
        reset({ active: true, hourly_cost: 0, max_active_os: 5, work_schedule: 'Seg-Sex, 08h as 18h', service_types: ['vehicle', 'machine', 'facility'] });
        setIsModalOpen(true);
    };

    const openEditModal = (tech: any) => {
        setEditingId(tech.id);
        reset({
            name: tech.name,
            contact: tech.contact || '',
            specialties: tech.specialties || '',
            hourly_cost: tech.hourly_cost || 0,
            work_schedule: tech.work_schedule || 'Seg-Sex, 08h as 18h',
            max_active_os: tech.max_active_os || 5,
            service_types: tech.service_types || ['vehicle', 'machine', 'facility'],
            active: tech.active
        });
        setIsModalOpen(true);
    };

    const filteredTechs = technicians.filter(t =>
        t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.specialties?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Equipe de Manutenção</h1>
                    <p className="text-slate-400 mt-1">Gerencie os técnicos, especialidades, custo de hora e disponibilidade.</p>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div>
                        <p className="text-sm font-medium text-slate-400">Técnicos Ativos</p>
                        <p className="text-3xl font-bold text-white font-mono mt-1">{kpis.total_techs}</p>
                    </div>
                    <div className="w-12 h-12 bg-[#5B5CFF]/20 text-[#5B5CFF] rounded-xl flex items-center justify-center glow-primary">
                        <Users className="w-6 h-6" />
                    </div>
                </div>
                <div className="glass-card p-6 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div>
                        <p className="text-sm font-medium text-slate-400">OS Concluídas no Mês</p>
                        <p className="text-3xl font-bold text-[#00E5FF] font-mono mt-1">{kpis.completed_os}</p>
                    </div>
                    <div className="w-12 h-12 bg-[#00E5FF]/20 text-[#00E5FF] rounded-xl flex items-center justify-center glow-secondary">
                        <CheckCircle className="w-6 h-6" />
                    </div>
                </div>
                <div className="glass-card p-6 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div>
                        <p className="text-sm font-medium text-slate-400">Tempo Médio p/ OS</p>
                        <p className="text-3xl font-bold text-amber-400 font-mono mt-1">{kpis.avg_time.toFixed(1)} <span className="text-xl">h</span></p>
                    </div>
                    <div className="w-12 h-12 bg-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center glow-warning">
                        <Clock className="w-6 h-6" />
                    </div>
                </div>
            </div>

            <Card className="glass-card bg-[#0f0f14]/50 border-white/5 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                    <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-[#00E5FF]" />
                        Listagem de Técnicos
                    </CardTitle>
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <Input
                                placeholder="Buscar por nome ou especialidade..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-72 bg-black/20 border-white/10 text-white placeholder:text-slate-500"
                            />
                        </div>
                        <Button onClick={openNewModal} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            <Plus className="w-4 h-4 mr-2" /> Novo Técnico
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-black/40">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-400">Nome / Contato</TableHead>
                                <TableHead className="text-slate-400">Especialidades</TableHead>
                                <TableHead className="text-slate-400">Escala / Valores</TableHead>
                                <TableHead className="text-center text-slate-400">Produtividade (Mês)</TableHead>
                                <TableHead className="text-slate-400">Status</TableHead>
                                <TableHead className="text-right text-slate-400">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">Carregando...</TableCell>
                                </TableRow>
                            ) : filteredTechs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">Nenhum técnico encontrado.</TableCell>
                                </TableRow>
                            ) : (
                                filteredTechs.map((tech) => (
                                    <TableRow key={tech.id} className="border-white/5 hover:bg-white/[0.02] hover:shadow-[inset_4px_0_0_0_#00E5FF] transition-all">
                                        <TableCell className="font-medium text-white">
                                            {tech.name}
                                            <div className="text-xs text-slate-400 font-normal">{tech.contact || 'Sem contato'}</div>
                                        </TableCell>
                                        <TableCell className="text-slate-300 max-w-[200px]">
                                            <span className="truncate block" title={tech.specialties}>{tech.specialties}</span>
                                            <div className="flex gap-1 mt-1 flex-wrap">
                                                {(tech.service_types || ['vehicle', 'machine', 'facility']).map((t: string) => (
                                                    <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20">
                                                        {SERVICE_TYPE_OPTIONS.find(o => o.value === t)?.emoji} {SERVICE_TYPE_OPTIONS.find(o => o.value === t)?.label || t}
                                                    </span>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-slate-300">
                                            <div className="text-sm">{tech.work_schedule}</div>
                                            <div className="text-xs text-[#00E5FF] font-semibold">R$ {Number(tech.hourly_cost).toFixed(2)} / hora</div>
                                            <div className="text-xs text-slate-500">Máx Ativas: {tech.max_active_os}</div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-lg font-bold text-emerald-400">{tech.completed_os_count || 0}</span>
                                                <span className="text-xs text-slate-500">OS Concluídas</span>
                                                {tech.total_hours_spent > 0 && <span className="text-[10px] text-amber-500/70">{tech.total_hours_spent}h gastas</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${tech.active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                                {tech.active ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => openEditModal(tech)} className="text-[#00E5FF] hover:text-white hover:bg-white/10" title="Editar">
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(tech.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10" title="Excluir">
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Editar Técnico' : 'Novo Técnico'} size="md">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-300">Nome Completo</label>
                            <Input {...register('name')} placeholder="Ex: João da Silva" className="mt-1 bg-black/20 border-white/10 text-white" />
                            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-300">Contato (Telefone/Email)</label>
                            <Input {...register('contact')} placeholder="Ex: (11) 99999-9999" className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-300">Especialidades</label>
                            <Input {...register('specialties')} placeholder="Ex: Elétrica automotiva, Ar condicionado, Mecânica Diesel..." className="mt-1 bg-black/20 border-white/10 text-white" />
                            {errors.specialties && <p className="text-red-400 text-xs mt-1">{errors.specialties.message}</p>}
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Tipos de Serviço</label>
                            <div className="flex gap-2">
                                {SERVICE_TYPE_OPTIONS.map(opt => {
                                    const isChecked = (watchedServiceTypes || []).includes(opt.value);
                                    return (
                                        <button key={opt.value} type="button"
                                            onClick={() => {
                                                const current = watchedServiceTypes || [];
                                                const next = isChecked ? current.filter(v => v !== opt.value) : [...current, opt.value];
                                                setValue('service_types', next.length > 0 ? next : [opt.value]);
                                            }}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                                                isChecked ? 'border-[#00E5FF] bg-[#00E5FF]/10 text-[#00E5FF]' : 'border-white/10 bg-black/20 text-slate-400 hover:border-white/20'
                                            }`}>
                                            <span>{opt.emoji}</span> {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="col-span-2 p-4 bg-black/30 border border-white/5 rounded-lg grid grid-cols-2 gap-4">
                            <h4 className="col-span-2 text-sm font-semibold text-white mb-2">Escala e Valores</h4>

                            <div>
                                <label className="block text-sm font-medium text-slate-300">Disponibilidade / Escala</label>
                                <Input {...register('work_schedule')} placeholder="Seg a Sex, 08h-18h" className="mt-1 bg-black/20 border-white/10 text-white" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300">Custo Hora (R$)</label>
                                <Input type="number" step="0.5" {...register('hourly_cost')} className="mt-1 bg-black/20 border-white/10 text-white" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300" title="Usado para avisar se o técnico está sobrecarregado.">Limite Max de O.S Simultâneas</label>
                                <Input type="number" step="1" {...register('max_active_os')} className="mt-1 bg-black/20 border-white/10 text-white" />
                            </div>

                            <div className="flex flex-col justify-end">
                                <label className="flex items-center space-x-2 text-sm text-slate-300 cursor-pointer">
                                    <input type="checkbox" {...register('active')} className="rounded border-slate-700 text-[#00E5FF] focus:ring-[#00E5FF] bg-black/20" />
                                    <span>Técnico Ativo</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="border border-white/10 text-slate-300 hover:bg-white/5">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            {isSubmitting ? 'Salvando...' : 'Salvar Técnico'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
