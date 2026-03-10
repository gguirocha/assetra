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

const machineSchema = z.object({
    name: z.string().min(2, 'Nome é muito curto'),
    model: z.string().optional(),
    serial_number: z.string().optional(),
    location: z.string().optional(),
    sector: z.string().optional(),
    usage_hours: z.coerce.number().min(0).default(0),
    status: z.enum(['ativo', 'manutencao', 'inativo']).default('ativo'),
});

type MachineFormValues = z.infer<typeof machineSchema>;

export default function MachinesPage() {
    const { session } = useAuth();
    const [machines, setMachines] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<MachineFormValues>({
        resolver: zodResolver(machineSchema) as any,
        defaultValues: { status: 'ativo', usage_hours: 0 }
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('assets_machines')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            setMachines(data || []);
        } catch (error) {
            console.error('Error fetching machines:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onSubmit = async (data: MachineFormValues) => {
        try {
            if (editingId) {
                const { error } = await supabase.from('assets_machines').update(data).eq('id', editingId);
                if (error) throw error;
            } else {
                let tenant_id = null;
                if (session?.user) {
                    const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                    tenant_id = prof?.tenant_id;
                }
                const { error } = await supabase.from('assets_machines').insert([{ ...data, tenant_id }]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingId(null);
            reset();
            fetchData();
        } catch (error: any) {
            alert('Erro ao salvar máquina: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir esta máquina? O histórico de ordens de serviço será apagado.')) return;
        const { error } = await supabase.from('assets_machines').delete().eq('id', id);
        if (error) alert('Erro ao excluir: ' + error.message);
        else fetchData();
    };

    const openNewModal = () => {
        setEditingId(null);
        reset({ status: 'ativo', usage_hours: 0 });
        setIsModalOpen(true);
    };

    const openEditModal = (machine: any) => {
        setEditingId(machine.id);
        reset({
            name: machine.name,
            model: machine.model || '',
            serial_number: machine.serial_number || '',
            location: machine.location || '',
            sector: machine.sector || '',
            usage_hours: machine.usage_hours || 0,
            status: machine.status,
        });
        setIsModalOpen(true);
    };

    const filteredMachines = machines.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.sector?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'ativo': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'manutencao': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'inativo': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Máquinas Cadastradas</h1>
                    <p className="text-slate-400 mt-1">Gerencie seu parque de máquinas e equipamentos industriais.</p>
                </div>
            </div>

            <Card className="glass-card bg-[#0f0f14]/50 border-white/5 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                    <CardTitle className="text-lg font-semibold text-white">Relação de Máquinas</CardTitle>
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <Input
                                placeholder="Buscar nome ou nº série..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-72 bg-black/20 border-white/10 text-white placeholder:text-slate-500"
                            />
                        </div>
                        <Button onClick={openNewModal} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            <Plus className="w-4 h-4 mr-2" /> Nova Máquina
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-black/40">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-400">Identificação / Modelo</TableHead>
                                <TableHead className="text-slate-400">Localização / Setor</TableHead>
                                <TableHead className="text-slate-400">Tempo de Uso (Hrs)</TableHead>
                                <TableHead className="text-slate-400">Status</TableHead>
                                <TableHead className="text-right text-slate-400">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-400">Carregando...</TableCell>
                                </TableRow>
                            ) : filteredMachines.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-400">Nenhuma máquina encontrada.</TableCell>
                                </TableRow>
                            ) : (
                                filteredMachines.map((machine) => (
                                    <TableRow key={machine.id} className="border-white/5 hover:bg-white/[0.02] hover:shadow-[inset_4px_0_0_0_#00E5FF] transition-all">
                                        <TableCell className="font-medium text-white">
                                            {machine.name}
                                            <div className="text-xs text-slate-500 mt-1">
                                                Mod: {machine.model || 'N/I'} | SN: {machine.serial_number || 'N/I'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-slate-300">
                                            {machine.location || 'Não definido'}
                                            <div className="text-xs text-[#00E5FF] mt-1">{machine.sector || 'N/I'}</div>
                                        </TableCell>
                                        <TableCell className="text-slate-400">
                                            {machine.usage_hours}h
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${getStatusStyle(machine.status)}`}>
                                                {machine.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => openEditModal(machine)} className="text-[#00E5FF] hover:text-white hover:bg-white/10">
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(machine.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Editar Máquina' : 'Cadastrar Máquina'} size="lg">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Nome de Identificação</label>
                            <Input {...register('name')} placeholder="Ex: Torno CNC 01..." className="mt-1 bg-black/20 border-white/10 text-white" />
                            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Modelo / Versão</label>
                            <Input {...register('model')} placeholder="Ex: Romi GL 250M" className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Número de Série (SN)</label>
                            <Input {...register('serial_number')} placeholder="Ex: SN-123456" className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Horímetro Consolidado (Horas) Inicial</label>
                            <Input type="number" step="0.5" {...register('usage_hours')} className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Localização (Unidade/Prédio)</label>
                            <Input {...register('location')} placeholder="Ex: Galpão Principal" className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Setor / Linha</label>
                            <Input {...register('sector')} placeholder="Ex: Linha de Montagem A" className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300">Status Operacional</label>
                        <select {...register('status')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]">
                            <option value="ativo" className="bg-[#0f0f14]">Ativo</option>
                            <option value="manutencao" className="bg-[#0f0f14]">Em Manutenção</option>
                            <option value="inativo" className="bg-[#0f0f14]">Inativo</option>
                        </select>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="border border-white/10 text-slate-300 hover:bg-white/5">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            {isSubmitting ? 'Salvando...' : 'Salvar Máquina'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
