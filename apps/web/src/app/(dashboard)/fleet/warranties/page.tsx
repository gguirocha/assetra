"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Trash2, Edit2, FileText, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const warrantySchema = z.object({
    vehicle_id: z.string().min(1, 'Veículo é obrigatório'),
    item_name: z.string().min(1, 'Item englobado na garantia é obrigatório'),
    supplier: z.string().min(1, 'Fornecedor é obrigatório'),
    conditions: z.string().optional(),
    start_date: z.string().min(1, 'Data de início é obrigatória'),
    end_date: z.string().min(1, 'Data de fim da garantia é obrigatória'),
});

type WarrantyFormValues = z.infer<typeof warrantySchema>;

export default function WarrantiesPage() {
    const [warranties, setWarranties] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<WarrantyFormValues>({
        resolver: zodResolver(warrantySchema) as any,
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [warrantiesRes, vehiclesRes] = await Promise.all([
                supabase.from('warranties').select('*, vehicles(plate, model)').order('end_date', { ascending: true }),
                supabase.from('vehicles').select('id, plate, model').order('plate')
            ]);

            if (warrantiesRes.error) throw warrantiesRes.error;
            setWarranties(warrantiesRes.data || []);
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

    const onSubmit = async (data: WarrantyFormValues) => {
        try {
            setUploading(true);
            let attachment_path = null;

            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `warranties/${data.vehicle_id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('fleet-documents')
                    .upload(filePath, selectedFile);

                if (uploadError) throw uploadError;
                attachment_path = filePath;
            }

            if (editingId) {
                const payload: any = { ...data };
                if (attachment_path) {
                    payload.attachment_path = attachment_path;
                }
                const { error } = await supabase.from('warranties').update(payload).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('warranties').insert([
                    { ...data, attachment_path }
                ]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingId(null);
            reset();
            setSelectedFile(null);
            fetchData();
        } catch (error: any) {
            console.error('Error saving warranty:', error.message);
            alert('Erro ao salvar garantia: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string, path: string | null) => {
        if (!confirm('Tem certeza que deseja excluir este registro de garantia?')) return;
        try {
            if (path) {
                await supabase.storage.from('fleet-documents').remove([path]);
            }
            const { error } = await supabase.from('warranties').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (error: any) {
            alert('Erro ao excluir: ' + error.message);
        }
    }

    const openAddModal = () => {
        setEditingId(null);
        reset({ start_date: '', end_date: '', item_name: '', supplier: '', conditions: '' });
        setSelectedFile(null);
        setIsModalOpen(true);
    };

    const openEditModal = (w: any) => {
        setEditingId(w.id);
        reset({
            vehicle_id: w.vehicle_id,
            item_name: w.item_name,
            supplier: w.supplier,
            conditions: w.conditions || '',
            start_date: w.start_date,
            end_date: w.end_date,
        });
        setSelectedFile(null);
        setIsModalOpen(true);
    };

    const getDownloadUrl = async (path: string) => {
        const { data } = await supabase.storage.from('fleet-documents').createSignedUrl(path, 60);
        if (data?.signedUrl) {
            window.open(data.signedUrl, '_blank');
        }
    };

    const isExpired = (dateStr: string) => {
        const expDate = new Date(dateStr);
        const today = new Date();
        expDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        return expDate < today;
    };

    const filteredWarranties = warranties.filter(w =>
        w.vehicles?.plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.supplier?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-100 uppercase tracking-wide">Garantias</h1>
                    <p className="text-sm text-slate-500">Controle de peças, serviços e pneus ainda em garantia.</p>
                </div>
                <Button onClick={openAddModal} className="flex items-center gap-2">
                    <Plus size={16} /> Registrar Garantia
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por placa, peça ou fornecedor..."
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
                                <TableHead>Item / Serviço</TableHead>
                                <TableHead>Fornecedor</TableHead>
                                <TableHead>Início</TableHead>
                                <TableHead>Término</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-slate-500 h-24">Carregando...</td>
                                </TableRow>
                            ) : filteredWarranties.length === 0 ? (
                                <TableRow>
                                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-slate-500 h-24">Nenhuma garantia registrada.</td>
                                </TableRow>
                            ) : (
                                filteredWarranties.map((w) => {
                                    const expired = isExpired(w.end_date);

                                    return (
                                        <TableRow key={w.id}>
                                            <TableCell className="font-medium text-slate-300">{w.vehicles?.plate?.toUpperCase()}</TableCell>
                                            <TableCell>{w.item_name}</TableCell>
                                            <TableCell>{w.supplier}</TableCell>
                                            <TableCell>{new Date(w.start_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {new Date(w.end_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                                    {expired && <span title="Garantia Expirada"><AlertTriangle size={14} className="text-amber-500" /></span>}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {expired ? (
                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600">Expirada</span>
                                                ) : (
                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400 border border-green-500/20">Ativa</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                {w.attachment_path && (
                                                    <Button variant="ghost" size="sm" className="text-blue-500" onClick={() => getDownloadUrl(w.attachment_path)} title="Ver Certificado">
                                                        <FileText size={16} />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600" onClick={() => openEditModal(w)} title="Editar">
                                                    <Edit2 size={16} />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(w.id, w.attachment_path)} title="Excluir">
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Garantia" : "Nova Garantia"} className="max-w-2xl">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="w-full">
                            <label className="block text-sm font-medium text-slate-300 mb-1">Veículo *</label>
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

                        <Input label="Item / Serviço (Ex: Bateria 150Ah) *" placeholder="Descreva o que está em garantia" {...register('item_name')} error={errors.item_name?.message as string} />

                        <div className="col-span-2">
                            <Input label="Fornecedor / Loja *" placeholder="Nome de onde foi comprado ou feito o serviço" {...register('supplier')} error={errors.supplier?.message as string} />
                        </div>

                        <Input label="Data de Início *" type="date" {...register('start_date')} error={errors.start_date?.message as string} />
                        <Input label="Data Final da Garantia *" type="date" {...register('end_date')} error={errors.end_date?.message as string} />
                    </div>

                    <div className="w-full">
                        <Input label="Condições de Garantia (Opcional)" placeholder="Revisão a cada 10.000km, etc" {...register('conditions')} error={errors.conditions?.message as string} />
                    </div>

                    <div className="w-full mt-4">
                        <label className="block text-sm font-medium text-slate-300 mb-1">Nota Fiscal / Certificado (PDF/Imagem)</label>
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
