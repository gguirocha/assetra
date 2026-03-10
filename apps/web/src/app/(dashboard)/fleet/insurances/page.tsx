"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Trash2, Edit2, FileText, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const insuranceSchema = z.object({
    vehicle_id: z.string().min(1, 'Veículo é obrigatório'),
    insurer_name: z.string().min(1, 'Seguradora / Associação é obrigatória'),
    policy_number: z.string().optional(),
    coverage_details: z.string().optional(),
    amount: z.coerce.number().min(0).default(0),
    start_date: z.string().min(1, 'Data de início é obrigatória'),
    end_date: z.string().min(1, 'Data de término é obrigatória'),
});

type InsuranceFormValues = z.infer<typeof insuranceSchema>;

export default function InsurancesPage() {
    const [insurances, setInsurances] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<InsuranceFormValues>({
        resolver: zodResolver(insuranceSchema) as any,
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [insurancesRes, vehiclesRes] = await Promise.all([
                supabase.from('insurances').select('*, vehicles(plate, model)').order('end_date', { ascending: true }),
                supabase.from('vehicles').select('id, plate, model').order('plate')
            ]);

            if (insurancesRes.error) throw insurancesRes.error;
            setInsurances(insurancesRes.data || []);
            setVehicles(vehiclesRes.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const onSubmit = async (data: InsuranceFormValues) => {
        try {
            setUploading(true);
            let attachment_path = null;

            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `insurances/${data.vehicle_id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('fleet-documents')
                    .upload(filePath, selectedFile);

                if (uploadError) throw uploadError;
                attachment_path = filePath;
            }

            const payload: any = { ...data };

            if (editingId) {
                if (attachment_path) payload.attachment_path = attachment_path;
                const { error } = await supabase.from('insurances').update(payload).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('insurances').insert([
                    { ...payload, attachment_path }
                ]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingId(null);
            reset();
            setSelectedFile(null);
            fetchData();
        } catch (error: any) {
            console.error('Error saving insurance:', error.message);
            alert('Erro ao salvar seguro: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string, path: string | null) => {
        if (!confirm('Tem certeza que deseja excluir esta apólice?')) return;
        try {
            if (path) {
                await supabase.storage.from('fleet-documents').remove([path]);
            }
            const { error } = await supabase.from('insurances').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (error: any) {
            alert('Erro ao excluir: ' + error.message);
        }
    }

    const openAddModal = () => {
        setEditingId(null);
        reset({ insurer_name: '', policy_number: '', coverage_details: '', amount: 0, start_date: '', end_date: '' });
        setSelectedFile(null);
        setIsModalOpen(true);
    };

    const openEditModal = (ins: any) => {
        setEditingId(ins.id);
        reset({
            vehicle_id: ins.vehicle_id,
            insurer_name: ins.insurer_name,
            policy_number: ins.policy_number || '',
            coverage_details: ins.coverage_details || '',
            amount: ins.amount || 0,
            start_date: ins.start_date,
            end_date: ins.end_date,
        });
        setSelectedFile(null);
        setIsModalOpen(true);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const getDownloadUrl = async (path: string) => {
        const { data } = await supabase.storage.from('fleet-documents').createSignedUrl(path, 60);
        if (data?.signedUrl) {
            window.open(data.signedUrl, '_blank');
        }
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

    const filteredInsurances = insurances.filter(i =>
        i.vehicles?.plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.insurer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.policy_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-100 uppercase tracking-wide">Seguros e Associações</h1>
                    <p className="text-sm text-slate-500">Gestão das apólices de seguro, prêmios e período de cobertura.</p>
                </div>
                <Button onClick={openAddModal} className="flex items-center gap-2">
                    <Plus size={16} /> Nova Apólice
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por placa, seguradora ou apólice..."
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
                                <TableHead>Veículo</TableHead>
                                <TableHead>Seguradora</TableHead>
                                <TableHead>Nº Apólice</TableHead>
                                <TableHead>Prêmio Pago</TableHead>
                                <TableHead>Validade (Vigência)</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-slate-500 h-24">Carregando...</td>
                                </TableRow>
                            ) : filteredInsurances.length === 0 ? (
                                <TableRow>
                                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-slate-500 h-24">Nenhum seguro localizado.</td>
                                </TableRow>
                            ) : (
                                filteredInsurances.map((ins) => {
                                    const expired = isExpired(ins.end_date);
                                    const soon = isExpiringSoon(ins.end_date);

                                    return (
                                        <TableRow key={ins.id}>
                                            <TableCell className="font-medium text-slate-300">{ins.vehicles?.plate?.toUpperCase()}</TableCell>
                                            <TableCell>{ins.insurer_name}</TableCell>
                                            <TableCell>{ins.policy_number || '-'}</TableCell>
                                            <TableCell>{formatCurrency(ins.amount)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    Até {new Date(ins.end_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                                    {expired && <span title="Apólice Vencida"><AlertTriangle size={14} className="text-red-500" /></span>}
                                                    {soon && <span title="Vence em menos de 30 dias"><AlertTriangle size={14} className="text-amber-500" /></span>}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {expired ? (
                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600">Encerrado</span>
                                                ) : (
                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400 border border-green-500/20">Ativo</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                {ins.attachment_path && (
                                                    <Button variant="ghost" size="sm" className="text-blue-500" onClick={() => getDownloadUrl(ins.attachment_path)}>
                                                        <FileText size={16} className="mr-1" /> PDF
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600" onClick={() => openEditModal(ins)} title="Editar">
                                                    <Edit2 size={16} />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(ins.id, ins.attachment_path)} title="Excluir">
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Seguro" : "Registrar Apólice"} className="max-w-2xl">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="w-full">
                            <label className="block text-sm font-medium text-slate-300 mb-1">Veículo Segurado *</label>
                            <select
                                {...register('vehicle_id')}
                                className="appearance-none block w-full px-3 py-2 border border-slate-700/50 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-900/50 text-slate-100"
                            >
                                <option value="">Selecione...</option>
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>{v.plate.toUpperCase()} - {v.model}</option>
                                ))}
                            </select>
                            {errors.vehicle_id && <p className="mt-1 text-sm text-red-600">{errors.vehicle_id.message as string}</p>}
                        </div>

                        <Input label="Seguradora / Associação *" placeholder="Ex: Porto Seguro, HDI" {...register('insurer_name')} error={errors.insurer_name?.message as string} />

                        <div className="w-full">
                            <Input label="Nº da Apólice (Opcional)" placeholder="Código/Número" {...register('policy_number')} error={errors.policy_number?.message as string} />
                        </div>

                        <div className="w-full">
                            <Input label="Prêmio Pago (R$ - Opcional)" type="number" step="0.01" {...register('amount')} error={errors.amount?.message as string} />
                        </div>

                        <Input label="Início da Vigência *" type="date" {...register('start_date')} error={errors.start_date?.message as string} />
                        <Input label="Final da Vigência *" type="date" required {...register('end_date')} error={errors.end_date?.message as string} />
                    </div>

                    <div className="w-full">
                        <Input label="Detalhes da Cobertura" placeholder="Ex: 100% FIPE, Terceiros R$ 100k, Guincho Ilimitado..." {...register('coverage_details')} error={errors.coverage_details?.message as string} />
                    </div>

                    <div className="w-full mt-4">
                        <label className="block text-sm font-medium text-slate-300 mb-1">Apólice / Boleto (PDF/Imagem)</label>
                        <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-2 border-t border-white/10">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" isLoading={uploading}>Salvar</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
