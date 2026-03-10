"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Edit2, Trash2, Settings, Zap, Droplets, AlertTriangle, CalendarClock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const ruleSchema = z.object({
    name: z.string().min(3, 'Nome é obrigatório'),
    vehicle_type: z.string().min(1, 'Tipo de veículo é obrigatório'),
    frequency_days: z.coerce.number().min(1, 'Mínimo 1 dia'),
    delay_alert_days: z.coerce.number().min(1, 'Mínimo 1 dia'),
    active: z.boolean().default(true),
});

type RuleFormValues = z.infer<typeof ruleSchema>;

export default function CarWashRulesPage() {
    const { session } = useAuth();
    const [rules, setRules] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RuleFormValues>({
        resolver: zodResolver(ruleSchema) as any,
        defaultValues: { active: true, frequency_days: 15, delay_alert_days: 3 }
    });

    // Get distinct vehicle types
    const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: rData, error } = await supabase.from('car_wash_rules').select('*').order('name');
            if (error) throw error;
            setRules(rData || []);

            const { data: vData } = await supabase.from('vehicles').select('id, plate, model, type').eq('status', 'ativo');
            if (vData) {
                setVehicles(vData);
                const types = [...new Set(vData.map(v => v.type).filter(Boolean))];
                setVehicleTypes(types);
            }
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const onSubmit = async (data: RuleFormValues) => {
        try {
            if (editingId) {
                const { error } = await supabase.from('car_wash_rules').update(data).eq('id', editingId);
                if (error) throw error;
            } else {
                let tenant_id = null;
                if (session?.user) {
                    const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                    tenant_id = prof?.tenant_id;
                }
                const { error } = await supabase.from('car_wash_rules').insert([{ ...data, tenant_id }]);
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
        if (!confirm('Excluir esta regra?')) return;
        const { error } = await supabase.from('car_wash_rules').delete().eq('id', id);
        if (error) alert('Erro: ' + error.message);
        else fetchData();
    };

    const openNewModal = () => {
        setEditingId(null);
        reset({ active: true, frequency_days: 15, delay_alert_days: 3 });
        setIsModalOpen(true);
    };

    const openEditModal = (r: any) => {
        setEditingId(r.id);
        reset({ name: r.name, vehicle_type: r.vehicle_type, frequency_days: r.frequency_days, delay_alert_days: r.delay_alert_days, active: r.active });
        setIsModalOpen(true);
    };

    // Gerar agendamentos automáticos com base nas regras
    const generateSchedules = async () => {
        if (!confirm('Gerar agendamentos automáticos com base nas regras ativas? Veículos que já possuem agendamento futuro serão ignorados.')) return;
        setGenerating(true);
        try {
            const activeRules = rules.filter(r => r.active);
            if (activeRules.length === 0) { alert('Nenhuma regra ativa encontrada.'); return; }

            let tenant_id = null;
            if (session?.user) {
                const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                tenant_id = prof?.tenant_id;
            }

            // Get existing future schedules
            const { data: existing } = await supabase
                .from('car_wash_schedules')
                .select('vehicle_id, scheduled_date')
                .in('status', ['agendada', 'em_execucao'])
                .gte('scheduled_date', new Date().toISOString());

            const existingVehicleIds = new Set((existing || []).map(e => e.vehicle_id));

            let count = 0;
            for (const rule of activeRules) {
                const matchingVehicles = vehicles.filter(v => v.type === rule.vehicle_type && !existingVehicleIds.has(v.id));

                for (const vehicle of matchingVehicles) {
                    // Get last wash
                    const { data: lastWash } = await supabase
                        .from('car_wash_schedules')
                        .select('scheduled_date')
                        .eq('vehicle_id', vehicle.id)
                        .order('scheduled_date', { ascending: false })
                        .limit(1);

                    let nextDate = new Date();
                    if (lastWash && lastWash.length > 0) {
                        nextDate = new Date(lastWash[0].scheduled_date);
                    }
                    nextDate.setDate(nextDate.getDate() + rule.frequency_days);

                    // If next date is in the past, schedule for tomorrow 8am
                    if (nextDate < new Date()) {
                        nextDate = new Date();
                        nextDate.setDate(nextDate.getDate() + 1);
                    }
                    nextDate.setHours(8, 0, 0, 0);

                    await supabase.from('car_wash_schedules').insert([{
                        tenant_id,
                        vehicle_id: vehicle.id,
                        wash_type: 'Simples',
                        scheduled_date: nextDate.toISOString(),
                        responsible: 'Auto-gerado',
                        status: 'agendada',
                        notes: `Gerado pela regra: ${rule.name}`
                    }]);
                    count++;
                }
            }

            alert(`✅ ${count} agendamento(s) gerado(s) com sucesso!`);
            fetchData();
        } catch (error: any) {
            alert('Erro: ' + error.message);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Settings className="w-7 h-7 text-[#00E5FF]" /> Regras Automáticas de Lavagem
                    </h1>
                    <p className="text-slate-400 mt-1">Configure regras para gerar agendamentos automáticos de lavagem por tipo de veículo.</p>
                </div>
            </div>

            {/* Info Card */}
            <div className="glass-card p-5 rounded-xl border border-[#00E5FF]/10">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-[#00E5FF]/20 text-[#00E5FF] rounded-lg flex items-center justify-center shrink-0">
                        <CalendarClock className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-white font-medium mb-1">Como funciona?</h3>
                        <p className="text-sm text-slate-400">
                            Crie regras definindo o tipo de veículo, a frequência em dias e o alerta de atraso.
                            Quando clicar em <strong className="text-[#00E5FF]">"Gerar Agendamentos"</strong>, o sistema verifica a última lavagem de cada veículo
                            do tipo selecionado e cria um novo agendamento automaticamente. Veículos com agendamento futuro são ignorados.
                        </p>
                    </div>
                    <Button
                        onClick={generateSchedules}
                        disabled={generating || rules.length === 0}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 text-white border-0 shrink-0"
                    >
                        <Zap className="w-4 h-4 mr-2" /> {generating ? 'Gerando...' : 'Gerar Agendamentos'}
                    </Button>
                </div>
            </div>

            <Card className="glass-card bg-[#0f0f14]/50 border-white/5 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                    <CardTitle className="text-lg font-semibold text-white">Regras Configuradas</CardTitle>
                    <Button onClick={openNewModal} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                        <Plus className="w-4 h-4 mr-2" /> Nova Regra
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-black/40">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-400">Nome</TableHead>
                                <TableHead className="text-slate-400">Tipo de Veículo</TableHead>
                                <TableHead className="text-slate-400">Frequência</TableHead>
                                <TableHead className="text-slate-400">Alerta Atraso</TableHead>
                                <TableHead className="text-slate-400">Status</TableHead>
                                <TableHead className="text-right text-slate-400">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Carregando...</TableCell></TableRow>
                            ) : rules.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Nenhuma regra cadastrada. Crie a primeira!</TableCell></TableRow>
                            ) : (
                                rules.map(r => (
                                    <TableRow key={r.id} className="border-white/5 hover:bg-white/[0.02] hover:shadow-[inset_4px_0_0_0_#00E5FF] transition-all">
                                        <TableCell className="font-medium text-white">{r.name}</TableCell>
                                        <TableCell className="text-slate-300 capitalize">{r.vehicle_type}</TableCell>
                                        <TableCell className="text-[#00E5FF] font-mono">A cada {r.frequency_days} dias</TableCell>
                                        <TableCell className="text-amber-400 font-mono flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> {r.delay_alert_days} dias
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${r.active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                                                {r.active ? 'Ativa' : 'Inativa'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => openEditModal(r)} className="text-[#00E5FF] hover:text-white hover:bg-white/10">
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Editar Regra' : 'Nova Regra de Lavagem'}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300">Nome da Regra *</label>
                        <Input {...register('name')} placeholder="Ex: Caminhões ativos - 15 dias" className="mt-1 bg-black/20 border-white/10 text-white" />
                        {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Tipo de Veículo *</label>
                            <select {...register('vehicle_type')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF]">
                                <option value="" className="bg-[#0f0f14]">Selecione...</option>
                                {vehicleTypes.map(t => (
                                    <option key={t} value={t} className="bg-[#0f0f14] capitalize">{t}</option>
                                ))}
                                <option value="caminhão" className="bg-[#0f0f14]">Caminhão</option>
                                <option value="carro" className="bg-[#0f0f14]">Carro</option>
                                <option value="van" className="bg-[#0f0f14]">Van</option>
                                <option value="moto" className="bg-[#0f0f14]">Moto</option>
                                <option value="ônibus" className="bg-[#0f0f14]">Ônibus</option>
                            </select>
                            {errors.vehicle_type && <p className="text-red-400 text-xs mt-1">{errors.vehicle_type.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Frequência (dias) *</label>
                            <Input type="number" {...register('frequency_days')} className="mt-1 bg-black/20 border-white/10 text-white" />
                            {errors.frequency_days && <p className="text-red-400 text-xs mt-1">{errors.frequency_days.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Alerta de Atraso (dias) *</label>
                            <Input type="number" {...register('delay_alert_days')} className="mt-1 bg-black/20 border-white/10 text-white" />
                            {errors.delay_alert_days && <p className="text-red-400 text-xs mt-1">{errors.delay_alert_days.message}</p>}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <input type="checkbox" {...register('active')} id="rule_active" className="accent-[#00E5FF] w-4 h-4" />
                        <label htmlFor="rule_active" className="text-sm text-slate-300">Regra ativa</label>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="border border-white/10 text-slate-300 hover:bg-white/5">Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            {isSubmitting ? 'Salvando...' : 'Salvar Regra'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
