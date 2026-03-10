"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const fineSchema = z.object({
    vehicle_id: z.string().min(1, 'Veículo é obrigatório'),
    driver_id: z.string().optional().or(z.literal('')),
    fine_number: z.string().min(1, 'Nº do Auto de Infração é obrigatório'),
    infraction_date: z.string().min(1, 'Data e hora são obrigatórias'),
    location: z.string().min(1, 'Local é obrigatório'),
    description: z.string().optional(),
    amount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
    points: z.coerce.number().min(0).default(0),
    status: z.enum(['unpaid', 'paid', 'appealed']).default('unpaid'),
    due_date: z.string().min(1, 'Data de Vencimento é obrigatória'),
});

type FineFormValues = z.infer<typeof fineSchema>;

export default function FinesPage() {
    const { session } = useAuth();
    const [fines, setFines] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FineFormValues>({
        resolver: zodResolver(fineSchema) as any,
        defaultValues: {
            status: 'unpaid',
            points: 0,
            amount: 0,
        }
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [finesRes, vehiclesRes, driversRes] = await Promise.all([
                supabase.from('fines').select('*, vehicles(plate, model), drivers(name)').order('infraction_date', { ascending: false }),
                supabase.from('vehicles').select('id, plate, model').order('plate'),
                supabase.from('drivers').select('id, name').order('name')
            ]);

            if (finesRes.error) throw finesRes.error;

            setFines(finesRes.data || []);
            setVehicles(vehiclesRes.data || []);
            setDrivers(driversRes.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onSubmit = async (data: FineFormValues) => {
        try {
            // Nullify driver_id if empty to prevent foreign key errors
            const payload = {
                ...data,
                driver_id: data.driver_id || null
            };

            if (editingId) {
                const { error } = await supabase.from('fines').update(payload).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('fines').insert([
                    payload
                ]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingId(null);
            reset();
            fetchData();
        } catch (error: any) {
            console.error('Error saving fine:', error.message);
            alert('Erro ao salvar multa: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta multa?')) return;
        try {
            const { error } = await supabase.from('fines').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (error: any) {
            alert('Erro ao excluir: ' + error.message);
        }
    }

    const openAddModal = () => {
        setEditingId(null);
        reset({ status: 'unpaid', points: 0, amount: 0 });
        setIsModalOpen(true);
    };

    const openEditModal = (fine: any) => {
        setEditingId(fine.id);

        let infraction_date = '';
        if (fine.infraction_date) {
            // Drop seconds/timezone for datetime-local
            infraction_date = new Date(fine.infraction_date).toISOString().substring(0, 16);
        }

        reset({
            vehicle_id: fine.vehicle_id,
            driver_id: fine.driver_id || '',
            fine_number: fine.fine_number,
            infraction_date: infraction_date,
            location: fine.location || '',
            description: fine.description || '',
            amount: fine.amount,
            points: fine.points,
            status: fine.status,
            due_date: fine.due_date,
        });
        setIsModalOpen(true);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const filteredFines = fines.filter(f =>
    (f.fine_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.vehicles?.plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.drivers?.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-100 uppercase tracking-wide">Multas e Infrações</h1>
                    <p className="text-sm text-slate-500">Controle de autos de infração de trânsito e pagamento de multas.</p>
                </div>
                <Button onClick={openAddModal} className="flex items-center gap-2">
                    <Plus size={16} /> Registrar Multa
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por placa, motorista, AIT..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-700/50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>AIT</TableHead>
                                <TableHead>Veículo</TableHead>
                                <TableHead>Data Infração</TableHead>
                                <TableHead>Motorista Infrator</TableHead>
                                <TableHead>Valor (Pts)</TableHead>
                                <TableHead>Vencimento</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <td colSpan={8} className="px-6 py-4 text-center text-sm text-slate-500 h-24">Carregando...</td>
                                </TableRow>
                            ) : filteredFines.length === 0 ? (
                                <TableRow>
                                    <td colSpan={8} className="px-6 py-4 text-center text-sm text-slate-500 h-24">Nenhuma multa localizada.</td>
                                </TableRow>
                            ) : (
                                filteredFines.map((fine) => {
                                    return (
                                        <TableRow key={fine.id}>
                                            <TableCell className="font-medium text-slate-300">{fine.fine_number}</TableCell>
                                            <TableCell>{fine.vehicles?.plate?.toUpperCase()}</TableCell>
                                            <TableCell>{new Date(fine.infraction_date).toLocaleString('pt-BR')}</TableCell>
                                            <TableCell>{fine.drivers?.name || <span className="text-slate-400 italic">Não identificado</span>}</TableCell>
                                            <TableCell>{formatCurrency(fine.amount)} <span className="text-xs font-semibold text-slate-500 ml-1">({fine.points} pts)</span></TableCell>
                                            <TableCell>{new Date(fine.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${fine.status === 'paid' ? 'bg-green-500/20 text-green-400 border border-green-500/20' :
                                                    fine.status === 'appealed' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' :
                                                        'bg-red-500/20 text-red-400 border border-red-500/20'
                                                    }`}>
                                                    {fine.status === 'paid' ? 'Pago' : fine.status === 'appealed' ? 'Em Recurso' : 'Em Aberto'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600" onClick={() => openEditModal(fine)} title="Editar">
                                                    <Edit2 size={16} />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(fine.id)} title="Excluir">
                                                    <Trash2 size={16} />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Multa" : "Registrar Multa"} className="max-w-2xl">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="w-full">
                            <label className="block text-sm font-medium text-slate-300 mb-1">Veículo Autuado *</label>
                            <select
                                {...register('vehicle_id')}
                                className="appearance-none block w-full px-3 py-2 border border-slate-700/50 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-900/50 text-slate-100"
                            >
                                <option value="">Selecione...</option>
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>{v.plate.toUpperCase()} - {v.model}</option>
                                ))}
                            </select>
                            {errors.vehicle_id && <p className="mt-1 text-sm text-red-600">{errors.vehicle_id.message}</p>}
                        </div>

                        <div className="w-full">
                            <label className="block text-sm font-medium text-slate-300 mb-1">Motorista Infrator</label>
                            <select
                                {...register('driver_id')}
                                className="appearance-none block w-full px-3 py-2 border border-slate-700/50 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-900/50 text-slate-100"
                            >
                                <option value="">Não identificado</option>
                                {drivers.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                            {errors.driver_id && <p className="mt-1 text-sm text-red-600">{errors.driver_id.message}</p>}
                        </div>

                        <Input label="Auto de Infração (AIT) *" placeholder="Ex: S12345678" {...register('fine_number')} error={errors.fine_number?.message} />
                        <Input label="Data e Hora da Infração *" type="datetime-local" {...register('infraction_date')} error={errors.infraction_date?.message} />
                    </div>

                    <div className="w-full">
                        <Input label="Local da Infração *" placeholder="Ex: BR 116 KM 205" {...register('location')} error={errors.location?.message} />
                    </div>

                    <div className="w-full">
                        <Input label="Descrição da Infração" placeholder="Ex: Excesso de velocidade em até 20%" {...register('description')} error={errors.description?.message} />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <Input label="Valor (R$) *" type="number" step="0.01" {...register('amount')} error={errors.amount?.message} />
                        <Input label="Pontos CNH *" type="number" {...register('points')} error={errors.points?.message} />

                        <div className="w-full col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-1">Status do Pagamento</label>
                            <select
                                {...register('status')}
                                className="appearance-none block w-full px-3 py-2 border border-slate-700/50 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-900/50 text-slate-100"
                            >
                                <option value="unpaid">Em Aberto (Não Pago)</option>
                                <option value="paid">Adimplente (Pago)</option>
                                <option value="appealed">Em Recurso (Defesa)</option>
                            </select>
                            {errors.status && <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>}
                        </div>
                    </div>

                    <div>
                        <Input label="Data de Vencimento *" type="date" required {...register('due_date')} error={errors.due_date?.message} />
                    </div>

                    <div className="pt-4 flex justify-end gap-2 border-t border-white/10">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" isLoading={isSubmitting}>Salvar Registro</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
