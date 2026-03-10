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

const facilityAssetSchema = z.object({
    name: z.string().min(2, 'Nome é muito curto'),
    category: z.string().min(1, 'Categoria é obrigatória'),
    location: z.string().min(1, 'Localização é obrigatória'),
    tag_qr_code: z.string().optional(),
    manufacturer: z.string().optional(),
    model: z.string().optional(),
    serial_number: z.string().optional(),
    installation_date: z.string().optional(),
    criticality: z.enum(['baixa', 'media', 'alta']).default('media'),
    status: z.enum(['ativo', 'manutencao', 'inativo']).default('ativo'),
});

type FacilityAssetFormValues = z.infer<typeof facilityAssetSchema>;

export default function FacilityAssetsPage() {
    const { session } = useAuth();
    const [assets, setAssets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FacilityAssetFormValues>({
        resolver: zodResolver(facilityAssetSchema) as any,
        defaultValues: { status: 'ativo', criticality: 'media' }
    });

    const categories = [
        'Ar Condicionado / Climatização', 'Elevadores', 'Geradores', 'Bombas e Motores',
        'Portões / Catracas', 'Elétrica', 'Hidráulica', 'Outros'
    ];

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('assets_facilities')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            setAssets(data || []);
        } catch (error) {
            console.error('Error fetching facility assets:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onSubmit = async (data: FacilityAssetFormValues) => {
        try {
            if (editingId) {
                const { error } = await supabase.from('assets_facilities').update(data).eq('id', editingId);
                if (error) throw error;
            } else {
                let tenant_id = null;
                if (session?.user) {
                    const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                    tenant_id = prof?.tenant_id;
                }
                const { error } = await supabase.from('assets_facilities').insert([{ ...data, tenant_id }]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingId(null);
            reset();
            fetchData();
        } catch (error: any) {
            alert('Erro ao salvar ativo: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este ativo predial?')) return;
        const { error } = await supabase.from('assets_facilities').delete().eq('id', id);
        if (error) alert('Erro ao excluir: ' + error.message);
        else fetchData();
    };

    const openNewModal = () => {
        setEditingId(null);
        reset({ status: 'ativo', criticality: 'media' });
        setIsModalOpen(true);
    };

    const openEditModal = (asset: any) => {
        setEditingId(asset.id);
        reset({
            name: asset.name,
            category: asset.category || '',
            location: asset.location || '',
            tag_qr_code: asset.tag_qr_code || '',
            manufacturer: asset.manufacturer || '',
            model: asset.model || '',
            serial_number: asset.serial_number || '',
            installation_date: asset.installation_date || '',
            criticality: asset.criticality || 'media',
            status: asset.status,
        });
        setIsModalOpen(true);
    };

    const filteredAssets = assets.filter(a =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.tag_qr_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'ativo': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'manutencao': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'inativo': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };

    const getCriticalityStyle = (crit: string) => {
        switch (crit) {
            case 'baixa': return 'text-slate-400';
            case 'media': return 'text-yellow-400';
            case 'alta': return 'text-red-500 font-bold';
            default: return 'text-slate-400';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Ativos Prediais (Facilities)</h1>
                    <p className="text-slate-400 mt-1">Gerencie a infraestrutura: ar condicionado, elevadores, elétrica e hidráulica.</p>
                </div>
            </div>

            <Card className="glass-card bg-[#0f0f14]/50 border-white/5 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                    <CardTitle className="text-lg font-semibold text-white">Inventário Predial</CardTitle>
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <Input
                                placeholder="Buscar por tag, nome ou local..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-72 bg-black/20 border-white/10 text-white placeholder:text-slate-500"
                            />
                        </div>
                        <Button onClick={openNewModal} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            <Plus className="w-4 h-4 mr-2" /> Novo Ativo
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-black/40">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-400">Identificação / Tag</TableHead>
                                <TableHead className="text-slate-400">Categoria</TableHead>
                                <TableHead className="text-slate-400">Localização</TableHead>
                                <TableHead className="text-slate-400">Criticidade</TableHead>
                                <TableHead className="text-slate-400">Status</TableHead>
                                <TableHead className="text-right text-slate-400">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">Carregando...</TableCell>
                                </TableRow>
                            ) : filteredAssets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">Nenhum ativo encontrado.</TableCell>
                                </TableRow>
                            ) : (
                                filteredAssets.map((asset) => (
                                    <TableRow key={asset.id} className="border-white/5 hover:bg-white/[0.02] hover:shadow-[inset_4px_0_0_0_#00E5FF] transition-all">
                                        <TableCell className="font-medium text-white">
                                            {asset.name}
                                            <div className="text-xs text-slate-500 mt-1">
                                                Tag/QR: {asset.tag_qr_code || 'N/A'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-slate-300">
                                            {asset.category}
                                        </TableCell>
                                        <TableCell className="text-slate-300">
                                            {asset.location}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`capitalize ${getCriticalityStyle(asset.criticality)}`}>
                                                {asset.criticality}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${getStatusStyle(asset.status)}`}>
                                                {asset.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => openEditModal(asset)} className="text-[#00E5FF] hover:text-white hover:bg-white/10">
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(asset.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Editar Ativo' : 'Cadastrar Ativo Predial'} size="lg">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Nome do Equipamento/Sistema</label>
                            <Input {...register('name')} placeholder="Ex: Ar Condicionado Split 01..." className="mt-1 bg-black/20 border-white/10 text-white" />
                            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Categoria</label>
                            <select {...register('category')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]">
                                <option value="" className="bg-[#0f0f14]">Selecione a categoria</option>
                                {categories.map(c => (
                                    <option key={c} value={c} className="bg-[#0f0f14]">{c}</option>
                                ))}
                            </select>
                            {errors.category && <p className="text-red-400 text-xs mt-1">{errors.category.message}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Localização (Prédio/Sala/Setor)</label>
                            <Input {...register('location')} placeholder="Ex: Prédio A, Sala 102" className="mt-1 bg-black/20 border-white/10 text-white" />
                            {errors.location && <p className="text-red-400 text-xs mt-1">{errors.location.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Tag / QR Code de Identificação</label>
                            <Input {...register('tag_qr_code')} placeholder="Ex: AC-01-S102" className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Fabricante</label>
                            <Input {...register('manufacturer')} placeholder="Ex: LG" className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Modelo / Versão</label>
                            <Input {...register('model')} placeholder="Ex: Dual Inverter 12000 BTU" className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Número de Série (SN)</label>
                            <Input {...register('serial_number')} placeholder="Ex: SN-987654" className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">Data de Instalação</label>
                            <Input type="date" {...register('installation_date')} className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Grau de Criticidade</label>
                            <select {...register('criticality')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]">
                                <option value="baixa" className="bg-[#0f0f14]">Baixa</option>
                                <option value="media" className="bg-[#0f0f14]">Média</option>
                                <option value="alta" className="bg-[#0f0f14]">Alta</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Status Operacional</label>
                            <select {...register('status')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]">
                                <option value="ativo" className="bg-[#0f0f14]">Ativo</option>
                                <option value="manutencao" className="bg-[#0f0f14]">Em Manutenção</option>
                                <option value="inativo" className="bg-[#0f0f14]">Inativo / Desativado</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="border border-white/10 text-slate-300 hover:bg-white/5">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            {isSubmitting ? 'Salvando...' : 'Salvar Ativo'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
