"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, Camera, Zap } from 'lucide-react';
import { PartsUsedPanel, savePendingPartsForOS, finalizePartsForOS, cancelPartsForOS } from '@/components/inventory/PartsUsedPanel';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const osSchema = z.object({
    type: z.literal('machine'),
    machine_id: z.string().min(1, 'Máquina é obrigatória'),
    requester_id: z.string().optional(),
    technician_id: z.string().optional(),
    priority: z.enum(['baixa', 'media', 'alta', 'urgente']).default('media'),
    description: z.string().min(5, 'Descrição é muito curta'),
    status: z.enum(['aberta', 'em_atendimento', 'pecas', 'concluida', 'cancelada']).default('aberta'),

    start_date: z.string().optional(),
    completion_date: z.string().optional(),
    time_spent_hours: z.coerce.number().min(0).optional(),
    labor_cost: z.coerce.number().min(0).optional(),
    parts_cost: z.coerce.number().min(0).optional(),
    third_party_cost: z.coerce.number().min(0).optional(),
    checklist_notes: z.string().optional(),
});

type OSFormValues = z.infer<typeof osSchema>;

export default function MachineOrdersPage() {
    const { session } = useAuth();
    const [orders, setOrders] = useState<any[]>([]);
    const [machines, setMachines] = useState<any[]>([]);
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<OSFormValues>({
        resolver: zodResolver(osSchema) as any,
        defaultValues: { type: 'machine', priority: 'media', status: 'aberta' }
    });

    const [suggesting, setSuggesting] = useState(false);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [pendingParts, setPendingParts] = useState<any[]>([]);
    const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(null);

    useEffect(() => {
        if (session?.user) {
            supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single().then(({ data }) => { if (data) setTenantId(data.tenant_id); });
        }
    }, [session]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch OS for machines
            const { data: osData, error: osError } = await supabase
                .from('work_orders')
                .select(`
                    *,
                    assets_machines ( name, model, serial_number )
                `)
                .eq('type', 'machine')
                .order('created_at', { ascending: false });

            if (osError) throw osError;
            setOrders(osData || []);

            // Fetch Machines for dropdown
            const { data: mData } = await supabase.from('assets_machines').select('id, name, model');
            if (mData) setMachines(mData);

            // Fetch Technicians for dropdown (full data for suggestion)
            const { data: tData } = await supabase.from('maintenance_technicians').select('id, name, specialties, max_active_os').eq('active', true);
            if (tData) setTechnicians(tData);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onSubmit = async (data: OSFormValues) => {
        try {
            if (editingId) {
                const checklistJson = data.checklist_notes ? data.checklist_notes.split('\n').map(item => ({ item: item.trim(), checked: false })).filter(i => i.item) : [];

                const cleanData = { ...data };
                if (cleanData.requester_id === "") cleanData.requester_id = undefined;
                if (cleanData.technician_id === "") cleanData.technician_id = undefined;
                if (cleanData.start_date === "") cleanData.start_date = undefined;
                if (cleanData.completion_date === "") cleanData.completion_date = undefined;

                const payload = { ...cleanData, checklist: checklistJson };
                delete (payload as any).checklist_notes;

                const { error } = await supabase.from('work_orders').update(payload).eq('id', editingId);
                if (error) throw error;
            } else {
                let tenant_id = null;
                if (session?.user) {
                    const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                    tenant_id = prof?.tenant_id;
                    data.requester_id = session.user.id;
                }

                const checklistJson = data.checklist_notes ? data.checklist_notes.split('\n').map(item => ({ item: item.trim(), checked: false })).filter(i => i.item) : [];

                const cleanData = { ...data };
                if (cleanData.requester_id === "") cleanData.requester_id = undefined;
                if (cleanData.technician_id === "") cleanData.technician_id = undefined;
                if (cleanData.start_date === "") cleanData.start_date = undefined;
                if (cleanData.completion_date === "") cleanData.completion_date = undefined;

                const payload = { ...cleanData, tenant_id, checklist: checklistJson };
                delete (payload as any).checklist_notes;

                const { data: inserted, error } = await supabase.from('work_orders').insert([payload]).select('id').single();
                if (error) throw error;

                if (inserted?.id && pendingParts.length > 0) {
                    await savePendingPartsForOS(inserted.id, pendingParts, tenant_id);
                }
            }

            if (editingId) {
                const currentOrder = orders.find(o => o.id === editingId);
                if (currentOrder && currentOrder.status !== data.status) {
                    if (data.status === 'concluida') await finalizePartsForOS(editingId, tenantId);
                    else if (data.status === 'cancelada') await cancelPartsForOS(editingId);
                }
            }

            setIsModalOpen(false);
            setEditingId(null);
            reset();
            fetchData();
        } catch (error: any) {
            alert('Erro ao salvar OS: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir esta Ordem de Serviço?')) return;
        const { error } = await supabase.from('work_orders').delete().eq('id', id);
        if (error) alert('Erro ao excluir OS: ' + error.message);
        else fetchData();
    };

    const openNewModal = () => {
        setEditingId(null);
        reset({ type: 'machine', priority: 'media', status: 'aberta' });
        setIsModalOpen(true);
    };

    const openEditModal = (os: any) => {
        setEditingId(os.id);
        reset({
            type: 'machine',
            machine_id: os.machine_id || '',
            requester_id: os.requester_id || '',
            technician_id: os.technician_id || '',
            priority: os.priority,
            description: os.description,
            status: os.status,
            start_date: os.start_date ? new Date(os.start_date).toISOString().split('T')[0] : '',
            completion_date: os.completion_date ? new Date(os.completion_date).toISOString().split('T')[0] : '',
            time_spent_hours: os.time_spent_hours || 0,
            labor_cost: os.labor_cost || 0,
            parts_cost: os.parts_cost || 0,
            third_party_cost: os.third_party_cost || 0,
            checklist_notes: os.checklist ? os.checklist.map((c: any) => c.item).join('\n') : ''
        });
        setIsModalOpen(true);
    };

    const filteredOrders = orders.filter(os =>
        os.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        os.assets_machines?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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

    const getPriorityStyle = (prio: string) => {
        switch (prio) {
            case 'baixa': return 'text-slate-400';
            case 'media': return 'text-[#00E5FF]';
            case 'alta': return 'text-orange-400';
            case 'urgente': return 'text-red-500 font-bold';
            default: return 'text-slate-400';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">OS de Máquinas</h1>
                    <p className="text-slate-400 mt-1">Gerencie aberturas e encerramentos de manutenção de equipamentos.</p>
                </div>
            </div>

            <Card className="glass-card bg-[#0f0f14]/50 border-white/5 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                    <CardTitle className="text-lg font-semibold text-white">OS Registradas</CardTitle>
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <Input
                                placeholder="Buscar por máquina ou descrição..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-72 bg-black/20 border-white/10 text-white placeholder:text-slate-500"
                            />
                        </div>
                        <Button onClick={openNewModal} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            <Plus className="w-4 h-4 mr-2" /> Aberta Nova OS
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-black/40">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-400">Ativo/Máquina</TableHead>
                                <TableHead className="text-slate-400">Descrição</TableHead>
                                <TableHead className="text-slate-400">Prioridade</TableHead>
                                <TableHead className="text-slate-400">Status</TableHead>
                                <TableHead className="text-slate-400">Abertura</TableHead>
                                <TableHead className="text-right text-slate-400">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><td colSpan={6} className="text-center py-8 text-slate-400">Carregando...</td></TableRow>
                            ) : filteredOrders.length === 0 ? (
                                <TableRow><td colSpan={6} className="text-center py-8 text-slate-400">Nenhuma Ordem de Serviço encontrada.</td></TableRow>
                            ) : (
                                filteredOrders.map((os) => (
                                    <TableRow key={os.id} className="border-white/5 hover:bg-white/[0.02] hover:shadow-[inset_4px_0_0_0_#00E5FF] transition-all">
                                        <TableCell className="font-medium text-white">
                                            {os.assets_machines?.name || 'N/A'}
                                            <div className="text-xs text-slate-500">{os.assets_machines?.model}</div>
                                        </TableCell>
                                        <TableCell className="text-slate-400 max-w-xs truncate">
                                            <span title={os.description}>{os.description}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`capitalize ${getPriorityStyle(os.priority)}`}>
                                                {os.priority}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusStyle(os.status)}`}>
                                                {os.status.replace('_', ' ')}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-slate-400">
                                            {new Date(os.opening_date).toLocaleDateString('pt-BR')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => openEditModal(os)} className="text-[#00E5FF] hover:text-white hover:bg-white/10">
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(os.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Editar OS' : 'Nova Ordem de Serviço'}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Máquina (Ativo)</label>
                            <select {...register('machine_id')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]">
                                <option value="" className="bg-[#0f0f14]">Selecione uma máquina...</option>
                                {machines.map(m => (
                                    <option key={m.id} value={m.id} className="bg-[#0f0f14]">{m.name} {m.model ? ` - ${m.model}` : ''}</option>
                                ))}
                            </select>
                            {errors.machine_id && <p className="text-red-400 text-xs mt-1">{errors.machine_id.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Prioridade</label>
                            <select {...register('priority')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]">
                                <option value="baixa" className="bg-[#0f0f14]">Baixa</option>
                                <option value="media" className="bg-[#0f0f14]">Média</option>
                                <option value="alta" className="bg-[#0f0f14]">Alta</option>
                                <option value="urgente" className="bg-[#0f0f14]">Urgente</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300">Descrição do Problema / Serviço</label>
                        <textarea
                            {...register('description')}
                            rows={4}
                            className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white placeholder:text-slate-600 focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]"
                            placeholder="Descreva o motivo da OS detalhadamente..."
                        />
                        {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Status da OS</label>
                            <select {...register('status')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]">
                                <option value="aberta" className="bg-[#0f0f14]">Aberta</option>
                                <option value="em_atendimento" className="bg-[#0f0f14]">Em Atendimento</option>
                                <option value="pecas" className="bg-[#0f0f14]">Aguardando Peças</option>
                                <option value="concluida" className="bg-[#0f0f14]">Concluída</option>
                                <option value="cancelada" className="bg-[#0f0f14]">Cancelada</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Técnico Responsável</label>
                            <div className="flex gap-2 mt-1">
                                <select {...register('technician_id')} className="flex-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]">
                                    <option value="" className="bg-[#0f0f14]">Nenhum / Não atribuído</option>
                                    {technicians.map(t => (
                                        <option key={t.id} value={t.id} className="bg-[#0f0f14]">{t.name}</option>
                                    ))}
                                </select>
                                <Button
                                    type="button"
                                    disabled={suggesting || technicians.length === 0}
                                    onClick={async () => {
                                        setSuggesting(true);
                                        try {
                                            const { data: activeOS } = await supabase
                                                .from('work_orders')
                                                .select('technician_id')
                                                .in('status', ['aberta', 'em_atendimento', 'pecas']);
                                            const osCounts: Record<string, number> = {};
                                            (activeOS || []).forEach(os => {
                                                if (os.technician_id) osCounts[os.technician_id] = (osCounts[os.technician_id] || 0) + 1;
                                            });
                                            const scored = technicians
                                                .map(t => ({ ...t, activeCount: osCounts[t.id] || 0, available: (osCounts[t.id] || 0) < (t.max_active_os || 5) }))
                                                .filter(t => t.available)
                                                .sort((a, b) => a.activeCount - b.activeCount);
                                            if (scored.length > 0) {
                                                setValue('technician_id', scored[0].id);
                                                alert(`✅ Técnico sugerido: ${scored[0].name}\nEspecialidades: ${scored[0].specialties || 'N/A'}\nOS ativas: ${scored[0].activeCount}/${scored[0].max_active_os || 5}`);
                                            } else {
                                                alert('⚠️ Todos os técnicos estão com carga máxima de OS ativas.');
                                            }
                                        } catch (err) { console.error(err); }
                                        finally { setSuggesting(false); }
                                    }}
                                    className="bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 px-2 shrink-0"
                                    title="Sugerir técnico com menor carga de trabalho"
                                >
                                    <Zap className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Data Início</label>
                            <Input
                                type="date"
                                {...register('start_date')}
                                className="mt-1 block w-full px-3 py-2 bg-black/20 border-white/10 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Data Conclusão</label>
                            <Input
                                type="date"
                                {...register('completion_date')}
                                className="mt-1 block w-full px-3 py-2 bg-black/20 border-white/10 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Tempo Gasto (h)</label>
                            <Input
                                type="number"
                                step="0.5"
                                {...register('time_spent_hours')}
                                className="mt-1 block w-full px-3 py-2 bg-black/20 border-white/10 text-white"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300">Checklist de Execução (Um item por linha)</label>
                        <textarea
                            {...register('checklist_notes')}
                            rows={3}
                            className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white placeholder:text-slate-600 focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]"
                            placeholder="Ex:&#10;Verificar filtros&#10;Lubrificação do eixo"
                        />
                    </div>

                    <div className="p-3 bg-black/30 border border-white/5 rounded-lg">
                        <PartsUsedPanel
                            workOrderId={editingId}
                            tenantId={tenantId}
                            currentUserId={session?.user?.id}
                            technicianId={selectedTechnicianId}
                            onPendingPartsChange={!editingId ? setPendingParts : undefined}
                        />
                    </div>

                    <div className="p-3 bg-black/30 border border-white/5 rounded-lg">
                        <h4 className="text-sm font-semibold text-white mb-3">Custos da Manutenção</h4>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400">Mão de Obra (R$)</label>
                                <Input type="number" step="0.01" {...register('labor_cost')} className="mt-1 bg-black/20 border-white/10 text-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400">Peças (R$)</label>
                                <Input type="number" step="0.01" {...register('parts_cost')} className="mt-1 bg-black/20 border-white/10 text-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400">Terceiros (R$)</label>
                                <Input type="number" step="0.01" {...register('third_party_cost')} className="mt-1 bg-black/20 border-white/10 text-white" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300">Galeria de Fotos / Anexos (.jpeg, .png, .pdf)</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-white/10 border-dashed rounded-md bg-black/20 hover:bg-white/5 transition-colors cursor-pointer">
                            <div className="space-y-1 text-center">
                                <Camera className="mx-auto h-8 w-8 text-slate-400" />
                                <div className="text-sm text-slate-400">
                                    <span className="text-[#00E5FF] font-medium">Faça upload de fotos</span> ou arraste os arquivos
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">Funcionalidade visual por enquando. Serão integradas via Supabase Storage em breve.</p>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="border border-white/10 text-slate-300 hover:bg-white/5">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            {isSubmitting ? 'Salvando...' : 'Salvar OS'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
