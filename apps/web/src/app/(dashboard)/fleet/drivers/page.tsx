"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const driverSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    cpf: z.string().min(11, 'CPF inválido').max(14),
    rg: z.string().optional(),
    cnh_number: z.string().min(1, 'Nº CNH é obrigatório'),
    cnh_category: z.string().min(1, 'Categoria é obrigatória'),
    cnh_expiration: z.string().min(1, 'Validade CNH é obrigatória'),
    status: z.enum(['ativo', 'inativo', 'ferias', 'afastado']).default('ativo'),
    phone: z.string().optional(),
    email: z.string().email('E-mail inválido').optional().or(z.literal('')),
});

type DriverFormValues = z.infer<typeof driverSchema>;

export default function DriversPage() {
    const { session } = useAuth();
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DriverFormValues>({
        resolver: zodResolver(driverSchema) as any,
        defaultValues: {
            status: 'ativo',
        }
    });

    const fetchDrivers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('drivers')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            setDrivers(data || []);
        } catch (error) {
            console.error('Error fetching drivers:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDrivers();
    }, []);

    const onSubmit = async (data: DriverFormValues) => {
        try {
            if (editingId) {
                const { error } = await supabase.from('drivers').update(data).eq('id', editingId);
                if (error) throw error;
            } else {
                let tenant_id = null;
                if (session?.user) {
                    const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                    tenant_id = prof?.tenant_id;
                }
                const { error } = await supabase.from('drivers').insert([
                    { ...data, tenant_id }
                ]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingId(null);
            reset();
            fetchDrivers();
        } catch (error: any) {
            console.error('Error saving driver:', error.message);
            alert('Erro ao salvar motorista: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este motorista?')) return;
        try {
            const { error } = await supabase.from('drivers').delete().eq('id', id);
            if (error) throw error;
            fetchDrivers();
        } catch (error: any) {
            alert('Erro ao excluir: ' + error.message);
        }
    }

    const openAddModal = () => {
        setEditingId(null);
        reset({ status: 'ativo' });
        setIsModalOpen(true);
    };

    const openEditModal = (driver: any) => {
        setEditingId(driver.id);
        reset({
            name: driver.name,
            cpf: driver.cpf,
            rg: driver.rg || undefined,
            cnh_number: driver.cnh_number,
            cnh_category: driver.cnh_category,
            cnh_expiration: driver.cnh_expiration,
            status: driver.status,
            phone: driver.phone || undefined,
            email: driver.email || undefined,
        });
        setIsModalOpen(true);
    };

    const isExpiringSoon = (dateStr: string) => {
        const expDate = new Date(dateStr);
        const today = new Date();
        const diffTime = expDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 30 && diffDays > 0;
    };

    const isExpired = (dateStr: string) => {
        const expDate = new Date(dateStr);
        const today = new Date();
        expDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        return expDate < today;
    };

    const filteredDrivers = drivers.filter(d =>
    (d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.cpf?.includes(searchTerm))
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-100 uppercase tracking-wide">Motoristas & CNH</h1>
                    <p className="text-sm text-slate-500">Gestão do quadro de motoristas e acompanhamento de vencimento das CNHs.</p>
                </div>
                <Button onClick={openAddModal} className="flex items-center gap-2">
                    <Plus size={16} /> Adicionar Motorista
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou CPF..."
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
                                <TableHead>Nome</TableHead>
                                <TableHead>CPF</TableHead>
                                <TableHead>Nº CNH / Categ.</TableHead>
                                <TableHead>Validade CNH</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-slate-500 h-24">Carregando...</td>
                                </TableRow>
                            ) : filteredDrivers.length === 0 ? (
                                <TableRow>
                                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-slate-500 h-24">Nenhum motorista encontrado.</td>
                                </TableRow>
                            ) : (
                                filteredDrivers.map((driver) => {
                                    const expired = isExpired(driver.cnh_expiration);
                                    const soon = isExpiringSoon(driver.cnh_expiration);

                                    return (
                                        <TableRow key={driver.id}>
                                            <TableCell className="font-medium">{driver.name}</TableCell>
                                            <TableCell>{driver.cpf}</TableCell>
                                            <TableCell>{driver.cnh_number} ({driver.cnh_category})</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {new Date(driver.cnh_expiration).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                                    {expired && <AlertTriangle size={14} className="text-red-500" />}
                                                    {soon && <AlertTriangle size={14} className="text-amber-500" />}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${driver.status === 'ativo' ? 'bg-green-500/20 text-green-400 border border-green-500/20' :
                                                        driver.status === 'ferias' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' :
                                                            'bg-slate-100 text-slate-200'
                                                    }`}>
                                                    {driver.status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600" onClick={() => openEditModal(driver)} title="Editar">
                                                    <Edit2 size={16} />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(driver.id)} title="Excluir">
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Motorista" : "Cadastrar Motorista"}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <Input label="Nome Completo *" placeholder="Ex: João Silva" {...register('name')} error={errors.name?.message} />
                        </div>

                        <Input label="CPF *" placeholder="000.000.000-00" {...register('cpf')} error={errors.cpf?.message} />
                        <Input label="RG" placeholder="00.000.000-0" {...register('rg')} error={errors.rg?.message} />

                        <Input label="Nº CNH *" {...register('cnh_number')} error={errors.cnh_number?.message} />

                        <div className="w-full">
                            <label className="block text-sm font-medium text-slate-300 mb-1">Categoria CNH *</label>
                            <select
                                {...register('cnh_category')}
                                className="appearance-none block w-full px-3 py-2 border border-slate-700/50 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-900/50 text-slate-100"
                            >
                                <option value="">Selecione...</option>
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                                <option value="E">E</option>
                                <option value="AB">AB</option>
                                <option value="AC">AC</option>
                                <option value="AD">AD</option>
                                <option value="AE">AE</option>
                            </select>
                            {errors.cnh_category && <p className="mt-1 text-sm text-red-600">{errors.cnh_category.message}</p>}
                        </div>

                        <Input label="Validade CNH *" type="date" required {...register('cnh_expiration')} error={errors.cnh_expiration?.message} />

                        <div className="w-full">
                            <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                            <select
                                {...register('status')}
                                className="appearance-none block w-full px-3 py-2 border border-slate-700/50 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-900/50 text-slate-100"
                            >
                                <option value="ativo">Ativo</option>
                                <option value="inativo">Inativo</option>
                                <option value="ferias">Férias</option>
                                <option value="afastado">Afastado</option>
                            </select>
                            {errors.status && <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>}
                        </div>

                        <Input label="Telefone" placeholder="(00) 00000-0000" {...register('phone')} error={errors.phone?.message} />
                        <Input label="E-mail" type="email" placeholder="email@exemplo.com" {...register('email')} error={errors.email?.message} />
                    </div>

                    <div className="pt-4 flex justify-end gap-2 border-t border-white/10">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" isLoading={isSubmitting}>Salvar Motorista</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
