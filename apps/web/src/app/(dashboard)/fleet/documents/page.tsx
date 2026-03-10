"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Trash2, Download, FileText, Edit2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const documentSchema = z.object({
    vehicle_id: z.string().min(1, 'Selecione um veículo'),
    type: z.enum(['CRLV', 'IPVA', 'Seguro', 'Outro']),
    document_number: z.string().optional(),
    issuer: z.string().optional(),
    issue_date: z.string().optional(),
    expiration_date: z.string().min(1, 'Data de validade é obrigatória'),
});

type DocumentFormValues = z.infer<typeof documentSchema>;

export default function VehicleDocumentsPage() {
    const { session } = useAuth();
    const [documents, setDocuments] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<DocumentFormValues>({
        resolver: zodResolver(documentSchema) as any,
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            // Fetch Vehicles for dropdown
            const { data: vData } = await supabase.from('vehicles').select('id, plate, model').order('plate');
            if (vData) setVehicles(vData);

            // Fetch Documents with vehicle info
            const { data: dData, error } = await supabase
                .from('vehicle_documents')
                .select('*, vehicles(plate, model)')
                .order('expiration_date', { ascending: true });

            if (error) throw error;
            setDocuments(dData || []);
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

    const onSubmit = async (data: DocumentFormValues) => {
        try {
            setUploading(true);
            let attachment_path = null;

            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${data.vehicle_id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('fleet-documents')
                    .upload(filePath, selectedFile);

                if (uploadError) throw uploadError;
                attachment_path = filePath;
            }

            if (editingId) {
                const updateData: any = {
                    vehicle_id: data.vehicle_id,
                    type: data.type,
                    document_number: data.document_number,
                    issuer: data.issuer,
                    issue_date: data.issue_date || null,
                    expiration_date: data.expiration_date,
                };
                if (attachment_path) {
                    updateData.attachment_path = attachment_path;
                }
                const { error: updateError } = await supabase.from('vehicle_documents').update(updateData).eq('id', editingId);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase.from('vehicle_documents').insert([
                    {
                        ...data,
                        issue_date: data.issue_date || null, // Convert empty string to null
                        attachment_path
                    }
                ]);
                if (insertError) throw insertError;
            }

            setIsModalOpen(false);
            setEditingId(null);
            reset();
            setSelectedFile(null);
            fetchData();
        } catch (error: any) {
            console.error('Error saving document:', error);
            alert('Erro ao salvar documento. Talvez o bucket "fleet-documents" precise ser criado.');
        } finally {
            setUploading(false);
        }
    };

    const openAddModal = () => {
        setEditingId(null);
        reset({
            type: 'CRLV'
        });
        setSelectedFile(null);
        setIsModalOpen(true);
    };

    const openEditModal = (doc: any) => {
        setEditingId(doc.id);
        reset({
            vehicle_id: doc.vehicle_id,
            type: doc.type,
            document_number: doc.document_number || undefined,
            issuer: doc.issuer || undefined,
            issue_date: doc.issue_date || undefined,
            expiration_date: doc.expiration_date,
        });
        setSelectedFile(null);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, path: string | null) => {
        if (!confirm('Tem certeza que deseja excluir este documento?')) return;
        try {
            // Se tem anexo, apaga o anexo também
            if (path) {
                await supabase.storage.from('fleet-documents').remove([path]);
            }

            const { error } = await supabase.from('vehicle_documents').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (error: any) {
            alert('Erro ao excluir: ' + error.message);
        }
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
        // Zera as horas pra comparar só o dia
        expDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        return expDate < today;
    };


    const filteredDocs = documents.filter(d =>
    (d.vehicles?.plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.type?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-100 uppercase tracking-wide">Documentos da Frota</h1>
                    <p className="text-sm text-slate-500">Controle IPVA, CRLV e seguros dos veículos e suas validades.</p>
                </div>
                <Button onClick={openAddModal} className="flex items-center gap-2">
                    <Plus size={16} /> Novo Documento
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por placa ou tipo..."
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
                                <TableHead>Tipo</TableHead>
                                <TableHead>Nº Documento</TableHead>
                                <TableHead>Validade</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-slate-500 h-24">Carregando...</td>
                                </TableRow>
                            ) : filteredDocs.length === 0 ? (
                                <TableRow>
                                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-slate-500 h-24">Nenhum documento encontrado.</td>
                                </TableRow>
                            ) : (
                                filteredDocs.map((doc) => {
                                    const expired = isExpired(doc.expiration_date);
                                    const soon = isExpiringSoon(doc.expiration_date);

                                    return (
                                        <TableRow key={doc.id}>
                                            <TableCell className="font-medium">{doc.vehicles?.plate?.toUpperCase()}</TableCell>
                                            <TableCell>{doc.type}</TableCell>
                                            <TableCell>{doc.document_number || '-'}</TableCell>
                                            <TableCell>{new Date(doc.expiration_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</TableCell>
                                            <TableCell>
                                                {expired ? (
                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-400 border border-red-500/20">Vencido</span>
                                                ) : soon ? (
                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/20">Vence em 30d</span>
                                                ) : (
                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400 border border-green-500/20">Regular</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                {doc.attachment_path && (
                                                    <Button variant="ghost" size="sm" className="text-blue-500" onClick={() => getDownloadUrl(doc.attachment_path)} title="Ver Anexo">
                                                        <FileText size={16} />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600" onClick={() => openEditModal(doc)} title="Editar">
                                                    <Edit2 size={16} />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(doc.id, doc.attachment_path)} title="Excluir">
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Documento" : "Lançar Documento"}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="w-full">
                        <label className="block text-sm font-medium text-slate-300 mb-1">Veículo *</label>
                        <select
                            {...register('vehicle_id')}
                            className="appearance-none block w-full px-3 py-2 border border-slate-700/50 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-900/50 text-slate-100"
                        >
                            <option value="">Selecione um veículo</option>
                            {vehicles.map(v => (
                                <option key={v.id} value={v.id}>{v.plate.toUpperCase()} - {v.model}</option>
                            ))}
                        </select>
                        {errors.vehicle_id && <p className="mt-1 text-sm text-red-600">{errors.vehicle_id.message as string}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="w-full">
                            <label className="block text-sm font-medium text-slate-300 mb-1">Tipo *</label>
                            <select
                                {...register('type')}
                                className="appearance-none block w-full px-3 py-2 border border-slate-700/50 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-900/50 text-slate-100"
                            >
                                <option value="CRLV">CRLV</option>
                                <option value="IPVA">IPVA</option>
                                <option value="Seguro">Seguro Obrigatório</option>
                                <option value="Outro">Outro</option>
                            </select>
                            {errors.type && <p className="mt-1 text-sm text-red-600">{errors.type.message as string}</p>}
                        </div>
                        <Input label="Nº Documento / Autenticação" {...register('document_number')} error={errors.document_number?.message as string} />

                        <Input label="Órgão Emissor" placeholder="Ex: Detran-SP" {...register('issuer')} error={errors.issuer?.message as string} />

                        <Input label="Data de Emissão" type="date" {...register('issue_date')} error={errors.issue_date?.message as string} />
                        <Input label="Data de Validade *" type="date" required {...register('expiration_date')} error={errors.expiration_date?.message as string} />
                    </div>

                    <div className="w-full mt-4">
                        <label className="block text-sm font-medium text-slate-300 mb-1">Anexo (PDF/Imagem - Opcional)</label>
                        <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-2 border-t border-white/10">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" isLoading={uploading}>Salvar Documento</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
