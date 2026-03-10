"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const planSchema = z.object({
    title: z.string().min(1, 'Título é obrigatório'),
    description: z.string().optional(),
    trigger_type: z.enum(['hours', 'days', 'both']).default('both'), // hours for machines
    trigger_km: z.coerce.number().min(0).optional(), // actually hours, we will map this to the DB later or just use trigger_km as a generic "usage" metric. Wait, the DB column is trigger_km, we will use it as hours.
    trigger_days: z.coerce.number().min(0).optional(),
    machine_id: z.string().optional(),
    service_id: z.string().min(1, 'Serviço é obrigatório'),
    active: z.boolean().default(true),
});

type PlanFormValues = z.infer<typeof planSchema>;

export default function MachinePreventivePlansPage() {
    const { session } = useAuth();
    const [plans, setPlans] = useState<any[]>([]);
    const [machines, setMachines] = useState<any[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<PlanFormValues>({
        resolver: zodResolver(planSchema) as any,
        defaultValues: { trigger_type: 'both', active: true }
    });

    const watchTriggerType = watch('trigger_type');

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: plansData, error: plansError } = await supabase
                .from('preventive_plans')
                .select(`
                    *,
                    assets_machines ( name, model ),
                    maintenance_services ( name, sla_hours )
                `)
                // Only show plans that apply to machines (where machine_id is not null, OR perhaps type='machine' if we added it, but let's filter by machine_id not null)
                .not('machine_id', 'is', null) // strict for this module
                .order('created_at', { ascending: false });

            // If we have "generic" plans, they have machine_id=null, facility_id=null, vehicle_id=null. 
            // We would need a 'module' column to distinguish a generic machine plan vs generic vehicle plan.
            // For now, let's just show plans with machine_id.

            if (plansError) throw plansError;
            setPlans(plansData || []);

            const { data: mData } = await supabase.from('assets_machines').select('id, name, model');
            if (mData) setMachines(mData);

            const { data: sData } = await supabase.from('maintenance_services').select('id, name').eq('active', true);
            if (sData) setServices(sData);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onSubmit = async (data: PlanFormValues) => {
        try {
            const payload = {
                title: data.title,
                description: data.description,
                trigger_type: data.trigger_type,
                trigger_km: data.trigger_type === 'days' ? null : data.trigger_km, // Using trigger_km for Hours
                trigger_days: data.trigger_type === 'hours' ? null : data.trigger_days,
                machine_id: data.machine_id || null,
                service_id: data.service_id,
                active: data.active
            };

            if (editingId) {
                const { error } = await supabase.from('preventive_plans').update(payload).eq('id', editingId);
                if (error) throw error;
            } else {
                let tenant_id = null;
                if (session?.user) {
                    const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                    tenant_id = prof?.tenant_id;
                }
                const { error } = await supabase.from('preventive_plans').insert([{ ...payload, tenant_id }]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingId(null);
            reset();
            fetchData();
        } catch (error: any) {
            alert('Erro ao salvar Plano: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este plano?')) return;
        const { error } = await supabase.from('preventive_plans').delete().eq('id', id);
        if (error) alert('Erro ao excluir: ' + error.message);
        else fetchData();
    };

    const openNewModal = () => {
        setEditingId(null);
        reset({ trigger_type: 'both', active: true });
        setIsModalOpen(true);
    };

    const openEditModal = (plan: any) => {
        setEditingId(plan.id);
        reset({
            title: plan.title,
            description: plan.description || '',
            trigger_type: plan.trigger_type,
            trigger_km: plan.trigger_km || 0,
            trigger_days: plan.trigger_days || 0,
            machine_id: plan.machine_id || '',
            service_id: plan.service_id || '',
            active: plan.active,
        });
        setIsModalOpen(true);
    };

    const filteredPlans = plans.filter(p =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.assets_machines?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getTriggerBadge = (type: string, km?: number, days?: number) => {
        if (type === 'hours' || type === 'km') return <span className="text-[#00E5FF] font-mono text-sm">{km} horas</span>;
        if (type === 'days') return <span className="text-purple-400 font-mono text-sm">{days} dias</span>;
        if (type === 'both') return (
            <div className="flex flex-col text-sm">
                <span className="text-[#00E5FF] font-mono">{km} horas</span>
                <span className="text-slate-500 text-xs">ou</span>
                <span className="text-purple-400 font-mono">{days} dias</span>
            </div>
        );
        return '-';
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Planos Preventivos de Máquinas</h1>
                    <p className="text-slate-400 mt-1">Configure disparadores automáticos baseados em tempo e/ou horas de uso.</p>
                </div>
            </div>

            <Card className="glass-card bg-[#0f0f14]/50 border-white/5 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                    <CardTitle className="text-lg font-semibold text-white">Planos Ativos</CardTitle>
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <Input
                                placeholder="Buscar plano ou máquina..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-72 bg-black/20 border-white/10 text-white placeholder:text-slate-500"
                            />
                        </div>
                        <Button onClick={openNewModal} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            <Plus className="w-4 h-4 mr-2" /> Novo Plano
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-black/40">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-400">Título / Serviço</TableHead>
                                <TableHead className="text-slate-400">Máquina</TableHead>
                                <TableHead className="text-slate-400">Regra (Gatilho)</TableHead>
                                <TableHead className="text-slate-400">Status</TableHead>
                                <TableHead className="text-right text-slate-400">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><td colSpan={5} className="text-center py-8 text-slate-400">Carregando...</td></TableRow>
                            ) : filteredPlans.length === 0 ? (
                                <TableRow><td colSpan={5} className="text-center py-8 text-slate-400">Nenhum plano encontrado.</td></TableRow>
                            ) : (
                                filteredPlans.map((plan) => (
                                    <TableRow key={plan.id} className="border-white/5 hover:bg-white/[0.02] hover:shadow-[inset_4px_0_0_0_#00E5FF] transition-all">
                                        <TableCell className="font-medium text-white max-w-[200px]">
                                            <div className="truncate">{plan.title}</div>
                                            <div className="text-xs text-[#00E5FF] truncate mt-0.5">{plan.maintenance_services?.name}</div>
                                        </TableCell>
                                        <TableCell className="text-slate-300">
                                            {plan.assets_machines ? (
                                                <span>{plan.assets_machines.name} <span className="text-slate-500 text-xs ml-1">({plan.assets_machines.model})</span></span>
                                            ) : (
                                                <span className="text-slate-500 text-xs bg-slate-800/50 px-2 py-1 rounded">Todas as Máquinas</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {getTriggerBadge(plan.trigger_type, plan.trigger_km, plan.trigger_days)}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${plan.active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                                {plan.active ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => openEditModal(plan)} className="text-slate-400 hover:text-white hover:bg-white/10">
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(plan.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Editar Plano Preventivo' : 'Novo Plano Preventivo'} size="lg">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                    <div>
                        <label className="block text-sm font-medium text-slate-300">Título do Plano</label>
                        <Input {...register('title')} placeholder="Ex: Revisão 500 horas Torno CNC" className="mt-1 bg-black/20 border-white/10 text-white" />
                        {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Serviço Agendado</label>
                            <select {...register('service_id')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]">
                                <option value="" className="bg-[#0f0f14]">Selecione um serviço...</option>
                                {services.map(s => (
                                    <option key={s.id} value={s.id} className="bg-[#0f0f14]">{s.name}</option>
                                ))}
                            </select>
                            {errors.service_id && <p className="text-red-400 text-xs mt-1">{errors.service_id.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Máquina Específica (Obrigatório por enquanto)</label>
                            <select {...register('machine_id')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]">
                                <option value="" className="bg-[#0f0f14]">Selecione a máquina</option>
                                {machines.map(m => (
                                    <option key={m.id} value={m.id} className="bg-[#0f0f14]">{m.name} - {m.model}</option>
                                ))}
                            </select>
                            {errors.machine_id && <p className="text-red-400 text-xs mt-1">{errors.machine_id.message}</p>}
                        </div>
                    </div>

                    <div className="p-4 bg-black/30 border border-white/5 rounded-lg space-y-4 mt-4">
                        <h4 className="text-sm font-semibold text-white">Regras de Gatilho</h4>

                        <div>
                            <label className="block text-sm font-medium text-slate-400">Modo de Disparo</label>
                            <select {...register('trigger_type')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]">
                                <option value="hours" className="bg-[#0f0f14]">Por Tempo de Uso (Horas)</option>
                                <option value="days" className="bg-[#0f0f14]">Por Tempo Corrido (Dias)</option>
                                <option value="both" className="bg-[#0f0f14]">Ambos (o que ocorrer primeiro)</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {(watchTriggerType === 'hours' || watchTriggerType === 'both') && (
                                <div>
                                    <label className="block text-sm font-medium text-[#00E5FF]">Frequência em Horas</label>
                                    <div className="mt-1 relative rounded-md shadow-sm">
                                        <Input type="number" step="0.5" {...register('trigger_km')} className="bg-black/20 border-white/10 text-white pr-16" placeholder="Ex: 500" />
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            <span className="text-slate-500 sm:text-sm">horas</span>
                                        </div>
                                    </div>
                                    {errors.trigger_km && <p className="text-red-400 text-xs mt-1">{errors.trigger_km.message}</p>}
                                </div>
                            )}

                            {(watchTriggerType === 'days' || watchTriggerType === 'both') && (
                                <div>
                                    <label className="block text-sm font-medium text-purple-400">Frequência em Dias</label>
                                    <div className="mt-1 relative rounded-md shadow-sm">
                                        <Input type="number" {...register('trigger_days')} className="bg-black/20 border-white/10 text-white pr-16" placeholder="Ex: 180" />
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            <span className="text-slate-500 sm:text-sm">dias</span>
                                        </div>
                                    </div>
                                    {errors.trigger_days && <p className="text-red-400 text-xs mt-1">{errors.trigger_days.message}</p>}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 mt-2">
                        <input type="checkbox" id="plan_active" {...register('active')} className="rounded border-slate-700 bg-slate-900 text-[#00E5FF] focus:ring-[#00E5FF]" />
                        <label htmlFor="plan_active" className="text-sm font-medium text-slate-300">Plano Ativo</label>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="border border-white/10 text-slate-300 hover:bg-white/5">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            {isSubmitting ? 'Salvando...' : 'Salvar Plano'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
