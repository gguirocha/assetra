"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, Camera, AlertTriangle, FileText } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const extinguisherSchema = z.object({
    location: z.string().min(1, 'Localização é obrigatória'),
    type: z.enum(['AP', 'CO2', 'PQS', 'Espuma', 'Outro']).default('PQS'),
    capacity: z.string().min(1, 'Capacidade é obrigatória (Ex: 4kg)'),
    seal_number: z.string().optional(),
    inspection_expiration: z.string().min(1, 'Vencimento da inspeção é obrigatório'),
    recharge_expiration: z.string().min(1, 'Vencimento da recarga é obrigatório'),
});

type ExtinguisherFormValues = z.infer<typeof extinguisherSchema>;

export default function ExtinguishersPage() {
    const { session } = useAuth();
    const [extinguishers, setExtinguishers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<ExtinguisherFormValues>({
        resolver: zodResolver(extinguisherSchema) as any,
        defaultValues: { type: 'PQS' }
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('extinguishers')
                .select('*')
                .order('inspection_expiration', { ascending: true }); // order by nearest expiration

            if (error) throw error;
            setExtinguishers(data || []);
        } catch (error) {
            console.error('Error fetching extinguishers:', error);
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

    const onSubmit = async (data: ExtinguisherFormValues) => {
        try {
            setUploading(true);
            let attachment_path = null;

            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `extinguishers/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('fleet-documents')
                    .upload(filePath, selectedFile);

                if (uploadError) throw uploadError;
                attachment_path = filePath;
            }

            if (editingId) {
                const updateData: any = { ...data };
                if (attachment_path) {
                    updateData.attachment_path = attachment_path;
                }
                const { error } = await supabase.from('extinguishers').update(updateData).eq('id', editingId);
                if (error) throw error;
            } else {
                let tenant_id = null;
                if (session?.user) {
                    const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                    tenant_id = prof?.tenant_id;
                }
                const insertData: any = { ...data, tenant_id };
                if (attachment_path) {
                    insertData.attachment_path = attachment_path;
                }
                const { error } = await supabase.from('extinguishers').insert([insertData]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingId(null);
            reset();
            setSelectedFile(null);
            fetchData();
        } catch (error: any) {
            console.error(error);
            alert('Erro ao salvar extintor. Talvez o anexo seja grande ou houve erro de rede.');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string, path: string | null) => {
        if (!confirm('Excluir este extintor?')) return;
        try {
            if (path) {
                await supabase.storage.from('fleet-documents').remove([path]);
            }
            const { error } = await supabase.from('extinguishers').delete().eq('id', id);
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

    const openNewModal = () => {
        setEditingId(null);
        reset({ type: 'PQS' });
        setSelectedFile(null);
        setIsModalOpen(true);
    };

    const openEditModal = (extinguisher: any) => {
        setEditingId(extinguisher.id);
        reset({
            location: extinguisher.location,
            type: extinguisher.type || 'PQS',
            capacity: extinguisher.capacity || '',
            seal_number: extinguisher.seal_number || '',
            inspection_expiration: extinguisher.inspection_expiration ? new Date(extinguisher.inspection_expiration).toISOString().split('T')[0] : '',
            recharge_expiration: extinguisher.recharge_expiration ? new Date(extinguisher.recharge_expiration).toISOString().split('T')[0] : '',
        });
        setSelectedFile(null);
        setIsModalOpen(true);
    };

    const filteredExtinguishers = extinguishers.filter(e =>
        e.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.seal_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.type?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getExpirationStatus = (dateString: string) => {
        const today = new Date();
        const expDate = new Date(dateString);
        const diffTime = expDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { label: 'Vencido', color: 'text-red-500 font-bold', bg: 'bg-red-500/10' };
        if (diffDays <= 30) return { label: `Vence em ${diffDays}d`, color: 'text-orange-400 font-medium', bg: 'bg-orange-500/10' };
        return { label: 'Regular', color: 'text-emerald-400', bg: 'bg-transparent' };
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Controle de Extintores</h1>
                    <p className="text-slate-400 mt-1">Monitore as localizações, tipos e validade de recargas e inspeções do seu parque de extintores.</p>
                </div>
            </div>

            <Card className="glass-card bg-[#0f0f14]/50 border-white/5 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                    <CardTitle className="text-lg font-semibold text-white">Relação de Extintores</CardTitle>
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <Input
                                placeholder="Buscar por local ou selo..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-72 bg-black/20 border-white/10 text-white placeholder:text-slate-500"
                            />
                        </div>
                        <Button onClick={openNewModal} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            <Plus className="w-4 h-4 mr-2" /> Adicionar Extintor
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-black/40">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-400">Localização</TableHead>
                                <TableHead className="text-slate-400">Tipo / Capacidade</TableHead>
                                <TableHead className="text-slate-400">Selo INMETRO</TableHead>
                                <TableHead className="text-slate-400">Vencimento Inspeção</TableHead>
                                <TableHead className="text-slate-400">Vencimento Recarga</TableHead>
                                <TableHead className="text-right text-slate-400">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">Carregando...</TableCell>
                                </TableRow>
                            ) : filteredExtinguishers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">Nenhum extintor encontrado.</TableCell>
                                </TableRow>
                            ) : (
                                filteredExtinguishers.map((ext) => {
                                    const inspStatus = getExpirationStatus(ext.inspection_expiration);
                                    const recStatus = getExpirationStatus(ext.recharge_expiration);

                                    return (
                                        <TableRow key={ext.id} className="border-white/5 hover:bg-white/[0.02] hover:shadow-[inset_4px_0_0_0_#00E5FF] transition-all">
                                            <TableCell className="font-medium text-white max-w-[200px] truncate">
                                                {ext.location}
                                            </TableCell>
                                            <TableCell className="text-slate-300">
                                                <span className="font-semibold text-[#00E5FF]">{ext.type}</span> - {ext.capacity}
                                            </TableCell>
                                            <TableCell className="text-slate-400">
                                                {ext.seal_number || 'N/A'}
                                            </TableCell>

                                            <TableCell className={inspStatus.bg}>
                                                <div className="flex flex-col">
                                                    <span className="text-slate-300 text-sm">{new Date(ext.inspection_expiration).toLocaleDateString('pt-BR')}</span>
                                                    <span className={`text-xs mt-0.5 flex items-center ${inspStatus.color}`}>
                                                        {inspStatus.label === 'Vencido' && <AlertTriangle className="w-3 h-3 mr-1" />}
                                                        {inspStatus.label}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            <TableCell className={recStatus.bg}>
                                                <div className="flex flex-col">
                                                    <span className="text-slate-300 text-sm">{new Date(ext.recharge_expiration).toLocaleDateString('pt-BR')}</span>
                                                    <span className={`text-xs mt-0.5 flex items-center ${recStatus.color}`}>
                                                        {recStatus.label === 'Vencido' && <AlertTriangle className="w-3 h-3 mr-1" />}
                                                        {recStatus.label}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            <TableCell className="text-right space-x-2">
                                                {ext.attachment_path && (
                                                    <Button variant="ghost" size="sm" className="text-[#00E5FF] hover:text-white hover:bg-white/10" onClick={() => getDownloadUrl(ext.attachment_path)} title="Ver Certificado">
                                                        <FileText className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" onClick={() => openEditModal(ext)} className="text-[#00E5FF] hover:text-white hover:bg-white/10" title="Editar">
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(ext.id, ext.attachment_path)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10" title="Excluir">
                                                    <Trash2 className="w-4 h-4" />
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Editar Extintor' : 'Cadastrar Extintor'} size="md">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                    <div>
                        <label className="block text-sm font-medium text-slate-300">Localização (Onde está instalado?)</label>
                        <Input {...register('location')} placeholder="Ex: Corredor Principal 2º Andar, Próx. Porta A" className="mt-1 bg-black/20 border-white/10 text-white" />
                        {errors.location && <p className="text-red-400 text-xs mt-1">{errors.location.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Tipo (Agente)</label>
                            <select {...register('type')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]">
                                <option value="AP" className="bg-[#0f0f14]">Água Pressurizada (AP)</option>
                                <option value="CO2" className="bg-[#0f0f14]">Gás Carbônico (CO2)</option>
                                <option value="PQS" className="bg-[#0f0f14]">Pó Químico Seco (PQS)</option>
                                <option value="Espuma" className="bg-[#0f0f14]">Espuma Mecânica</option>
                                <option value="Outro" className="bg-[#0f0f14]">Outro / Classe K</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Capacidade (Peso/Volume)</label>
                            <Input {...register('capacity')} placeholder="Ex: 4kg, 10L..." className="mt-1 bg-black/20 border-white/10 text-white" />
                            {errors.capacity && <p className="text-red-400 text-xs mt-1">{errors.capacity.message}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300">Selo INMETRO / Nº Identificação (Opcional)</label>
                        <Input {...register('seal_number')} placeholder="Ex: 12345678-9" className="mt-1 bg-black/20 border-white/10 text-white" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4 bg-black/30 border border-white/5 rounded-lg">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Vencimento da <strong className="text-purple-400">Inspeção</strong></label>
                            <Input type="date" {...register('inspection_expiration')} className="mt-1 bg-black/20 border-white/10 text-white" />
                            {errors.inspection_expiration && <p className="text-red-400 text-xs mt-1">{errors.inspection_expiration.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Vencimento da <strong className="text-emerald-400">Recarga</strong></label>
                            <Input type="date" {...register('recharge_expiration')} className="mt-1 bg-black/20 border-white/10 text-white" />
                            {errors.recharge_expiration && <p className="text-red-400 text-xs mt-1">{errors.recharge_expiration.message}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300">Foto ou Certificado (PDF/Imagem - Opcional)</label>
                        <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFileChange}
                            className="mt-1 block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#00E5FF]/20 file:text-[#00E5FF] hover:file:bg-[#00E5FF]/30 cursor-pointer"
                        />
                        {selectedFile && <p className="text-xs text-[#00E5FF] mt-2">Arquivo selecionado: {selectedFile.name}</p>}
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="border border-white/10 text-slate-300 hover:bg-white/5">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={uploading} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            {uploading ? 'Salvando...' : 'Salvar Extintor'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
