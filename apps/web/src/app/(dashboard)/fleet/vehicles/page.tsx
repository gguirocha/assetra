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

// Define the Zod schema for validation
const vehicleSchema = z.object({
    type: z.string().min(1, 'Tipo é obrigatório'),
    plate: z.string().min(7, 'Placa inválida').max(10),
    renavam: z.string().optional(),
    chassis: z.string().optional(),
    brand: z.string().min(1, 'Marca é obrigatória'),
    model: z.string().min(1, 'Modelo é obrigatório'),
    year: z.coerce.number().min(1900).max(2100).optional(),
    fuel_type: z.string().optional(),
    capacity: z.string().optional(),
    current_odometer: z.coerce.number().min(0).default(0),
    status: z.enum(['ativo', 'manutencao', 'inativo', 'vendido']).default('ativo'),
    cost_center: z.string().optional(),
    notes: z.string().optional(),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

export default function VehiclesPage() {
    const { session } = useAuth();
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<VehicleFormValues>({
        resolver: zodResolver(vehicleSchema) as any, // Suppress strict resolver mismatch due to zod coercion
        defaultValues: {
            status: 'ativo',
            current_odometer: 0,
        }
    });

    const fetchVehicles = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('vehicles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setVehicles(data || []);
        } catch (error) {
            console.error('Error fetching vehicles:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVehicles();
    }, []);

    const onSubmit = async (data: VehicleFormValues) => {
        try {
            if (editingId) {
                const { error } = await supabase.from('vehicles').update(data).eq('id', editingId);
                if (error) throw error;
            } else {
                let tenant_id = null;
                if (session?.user) {
                    const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                    tenant_id = prof?.tenant_id;
                }
                const { error } = await supabase.from('vehicles').insert([
                    { ...data, tenant_id }
                ]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingId(null);
            reset();
            fetchVehicles();
        } catch (error: any) {
            console.error('Error saving vehicle:', error.message);
            alert('Erro ao salvar veículo: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este veículo?')) return;
        try {
            const { error } = await supabase.from('vehicles').delete().eq('id', id);
            if (error) throw error;
            fetchVehicles();
        } catch (error: any) {
            alert('Erro ao excluir: ' + error.message);
        }
    }

    const openAddModal = () => {
        setEditingId(null);
        reset({ status: 'ativo', current_odometer: 0 });
        setIsModalOpen(true);
    };

    const openEditModal = (vehicle: any) => {
        setEditingId(vehicle.id);
        reset({
            type: vehicle.type,
            plate: vehicle.plate,
            renavam: vehicle.renavam || undefined,
            chassis: vehicle.chassis || undefined,
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year || undefined,
            fuel_type: vehicle.fuel_type || undefined,
            capacity: vehicle.capacity || undefined,
            current_odometer: vehicle.current_odometer,
            status: vehicle.status,
            cost_center: vehicle.cost_center || undefined,
            notes: vehicle.notes || undefined,
        });
        setIsModalOpen(true);
    };

    const filteredVehicles = vehicles.filter(v =>
    (v.plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.brand?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-100 uppercase tracking-wide">Frota (Veículos)</h1>
                    <p className="text-sm text-slate-500">Gerencie todos os veículos ativos e inativos da frota.</p>
                </div>
                <Button onClick={openAddModal} className="flex items-center gap-2">
                    <Plus size={16} /> Novo Veículo
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por placa, modelo..."
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
                                <TableHead>Placa</TableHead>
                                <TableHead>Marca/Modelo</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Hodômetro</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-slate-500 h-24">Carregando...</td>
                                </TableRow>
                            ) : filteredVehicles.length === 0 ? (
                                <TableRow>
                                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-slate-500 h-24">Nenhum veículo encontrado.</td>
                                </TableRow>
                            ) : (
                                filteredVehicles.map((vehicle) => (
                                    <TableRow key={vehicle.id}>
                                        <TableCell className="font-medium">{vehicle.plate.toUpperCase()}</TableCell>
                                        <TableCell>{vehicle.brand} {vehicle.model}</TableCell>
                                        <TableCell className="capitalize">{vehicle.type}</TableCell>
                                        <TableCell>{vehicle.current_odometer} km</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${vehicle.status === 'ativo' ? 'bg-green-500/20 text-green-400 border border-green-500/20' :
                                                vehicle.status === 'manutencao' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' :
                                                    'bg-slate-100 text-slate-200'
                                                }`}>
                                                {vehicle.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600" onClick={() => openEditModal(vehicle)} title="Editar">
                                                <Edit2 size={16} />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(vehicle.id)} title="Excluir">
                                                <Trash2 size={16} />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Veículo" : "Cadastrar Veículo"}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Placa" placeholder="ABC1D23" {...register('plate')} error={errors.plate?.message} />
                        <Input label="Tipo" placeholder="Ex: Caminhão, Carro" {...register('type')} error={errors.type?.message} />

                        <Input label="Marca" placeholder="Ex: Volvo, Fiat" {...register('brand')} error={errors.brand?.message} />
                        <Input label="Modelo" placeholder="Ex: FH 540, Strada" {...register('model')} error={errors.model?.message} />

                        <Input label="Ano" type="number" {...register('year')} error={errors.year?.message} />
                        <Input label="Combustível" placeholder="Ex: Diesel, Flex" {...register('fuel_type')} error={errors.fuel_type?.message} />

                        <Input label="Renavam" {...register('renavam')} error={errors.renavam?.message} />
                        <Input label="Chassi" {...register('chassis')} error={errors.chassis?.message} />

                        <Input label="Hodômetro Inicial" type="number" {...register('current_odometer')} error={errors.current_odometer?.message} />

                        <div className="w-full">
                            <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                            <select
                                {...register('status')}
                                className="appearance-none block w-full px-3 py-2 border border-slate-700/50 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-900/50 text-slate-100"
                            >
                                <option value="ativo">Ativo</option>
                                <option value="manutencao">Em Manutenção</option>
                                <option value="inativo">Parado/Inativo</option>
                                <option value="vendido">Vendido</option>
                            </select>
                            {errors.status && <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>}
                        </div>
                    </div>

                    <div className="w-full mt-4">
                        <label className="block text-sm font-medium text-slate-300 mb-1">Observações</label>
                        <textarea
                            {...register('notes')}
                            rows={3}
                            className="appearance-none block w-full px-3 py-2 border border-slate-700/50 rounded-md shadow-sm focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF] sm:text-sm bg-slate-900/50 text-slate-100 placeholder-slate-500 transition-colors"
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-2 border-t border-white/10">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" isLoading={isSubmitting}>Salvar Veículo</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
