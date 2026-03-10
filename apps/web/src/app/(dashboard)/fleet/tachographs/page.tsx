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

const tachographSchema = z.object({
    vehicle_id: z.string().min(1, 'Veículo é obrigatório'),
    check_date: z.string().min(1, 'A data de aferição é obrigatória'),
    expiration_date: z.string().min(1, 'A data de vencimento é obrigatória'),
});

type TachographFormValues = z.infer<typeof tachographSchema>;

export default function TachographsPage() {
    const { session } = useAuth();
    const [checks, setChecks] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<TachographFormValues>({
        resolver: zodResolver(tachographSchema) as any,
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [checksRes, vehiclesRes] = await Promise.all([
                supabase.from('tachograph_checks').select('*, vehicles(plate, model)').order('expiration_date', { ascending: true }),
                supabase.from('vehicles').select('id, plate, model').order('plate')
            ]);

            if (checksRes.error) throw checksRes.error;
            setChecks(checksRes.data || []);
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

    const onSubmit = async (data: TachographFormValues) => {
        try {
            setUploading(true);
            let attachment_path = null;

            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `tachographs/${data.vehicle_id}/${fileName}`;

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
                const { error } = await supabase.from('tachograph_checks').update(payload).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('tachograph_checks').insert([
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
            console.error('Error saving tachograph:', error.message);
            alert('Erro ao salvar aferição: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string, path: string | null) => {
        if (!confirm('Tem certeza que deseja excluir este registro?')) return;
        try {
            if (path) {
                await supabase.storage.from('fleet-documents').remove([path]);
            }
            const { error } = await supabase.from('tachograph_checks').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (error: any) {
            alert('Erro ao excluir: ' + error.message);
        }
    }

    const openAddModal = () => {
        setEditingId(null);
        reset({ check_date: '', expiration_date: '' });
        setSelectedFile(null);
        setIsModalOpen(true);
    };

    const openEditModal = (check: any) => {
        setEditingId(check.id);
        reset({
            vehicle_id: check.vehicle_id,
            check_date: check.check_date,
            expiration_date: check.expiration_date,
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

    const filteredChecks = checks.filter(c =>
        c.vehicles?.plate?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-100 uppercase tracking-wide">Aferição de Tacógrafos</h1>
                    <p className="text-sm text-slate-500">Controle de validade dos ensaios metrológicos dos tacógrafos da frota.</p>
                </div>
                <Button onClick={openAddModal} className="flex items-center gap-2">
                    <Plus size={16} /> Nova Aferição
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por placa..."
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
                                <TableHead>Data da Aferição</TableHead>
                                <TableHead>Validade (Vencimento)</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-slate-500 h-24">Carregando...</td>
                                </TableRow>
                            ) : filteredChecks.length === 0 ? (
                                <TableRow>
                                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-slate-500 h-24">Nenhuma aferição registrada.</td>
                                </TableRow>
                            ) : (
                                filteredChecks.map((check) => {
                                    const expired = isExpired(check.expiration_date);
                                    const soon = isExpiringSoon(check.expiration_date);

                                    return (
                                        <TableRow key={check.id}>
                                            <TableCell className="font-medium text-slate-300">{check.vehicles?.plate?.toUpperCase()}</TableCell>
                                            <TableCell>{new Date(check.check_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {new Date(check.expiration_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                                    {expired && <AlertTriangle size={14} className="text-red-500" />}
                                                    {soon && <AlertTriangle size={14} className="text-amber-500" />}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {expired ? (
                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-400 border border-red-500/20">Vencido</span>
                                                ) : soon ? (
                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/20">Vence em Breve</span>
                                                ) : (
                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400 border border-green-500/20">Regular</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                {check.attachment_path && (
                                                    <Button variant="ghost" size="sm" className="text-blue-500" onClick={() => getDownloadUrl(check.attachment_path)} title="Ver Certificado">
                                                        <FileText size={16} />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600" onClick={() => openEditModal(check)} title="Editar">
                                                    <Edit2 size={16} />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(check.id, check.attachment_path)} title="Excluir">
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Aferição" : "Registrar Aferição"} className="max-w-md">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Data de Aferição *" type="date" {...register('check_date')} error={errors.check_date?.message as string} />
                        <Input label="Data de Vencimento *" type="date" required {...register('expiration_date')} error={errors.expiration_date?.message as string} />
                    </div>

                    <div className="w-full mt-4">
                        <label className="block text-sm font-medium text-slate-300 mb-1">Certificado (PDF/Imagem)</label>
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
