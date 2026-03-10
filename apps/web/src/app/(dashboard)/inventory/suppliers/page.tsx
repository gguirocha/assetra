"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, Building2, Phone, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const supplierSchema = z.object({
    name: z.string().min(2, 'Nome é obrigatório'),
    cnpj: z.string().optional(),
    contact_name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    category: z.string().optional(),
    notes: z.string().optional(),
    active: z.boolean().default(true),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

export default function SuppliersPage() {
    const { session } = useAuth();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SupplierFormValues>({
        resolver: zodResolver(supplierSchema) as any,
        defaultValues: { active: true }
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('suppliers').select('*').order('name');
            if (error) throw error;
            setSuppliers(data || []);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const onSubmit = async (data: SupplierFormValues) => {
        try {
            if (editingId) {
                const { error } = await supabase.from('suppliers').update(data).eq('id', editingId);
                if (error) throw error;
            } else {
                let tenant_id = null;
                if (session?.user) {
                    const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                    tenant_id = prof?.tenant_id;
                }
                const { error } = await supabase.from('suppliers').insert([{ ...data, tenant_id }]);
                if (error) throw error;
            }
            setIsModalOpen(false);
            setEditingId(null);
            reset();
            fetchData();
        } catch (error: any) {
            alert('Erro: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este fornecedor?')) return;
        const { error } = await supabase.from('suppliers').delete().eq('id', id);
        if (error) alert('Erro: ' + error.message);
        else fetchData();
    };

    const openNewModal = () => { setEditingId(null); reset({ active: true }); setIsModalOpen(true); };
    const openEditModal = (s: any) => {
        setEditingId(s.id);
        reset({ name: s.name, cnpj: s.cnpj || '', contact_name: s.contact_name || '', phone: s.phone || '', email: s.email || '', address: s.address || '', category: s.category || '', notes: s.notes || '', active: s.active });
        setIsModalOpen(true);
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.cnpj?.includes(searchTerm) ||
        s.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Building2 className="w-7 h-7 text-[#00E5FF]" /> Cadastro de Fornecedores
                </h1>
                <p className="text-slate-400 mt-1">Gerencie os fornecedores de peças, serviços e materiais.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total</p><p className="text-2xl font-bold text-white font-mono mt-1">{suppliers.length}</p></div>
                    <div className="w-10 h-10 bg-[#5B5CFF]/20 text-[#5B5CFF] rounded-lg flex items-center justify-center"><Building2 className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Ativos</p><p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{suppliers.filter(s => s.active).length}</p></div>
                    <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center"><Building2 className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Categorias</p><p className="text-2xl font-bold text-[#00E5FF] font-mono mt-1">{new Set(suppliers.map(s => s.category).filter(Boolean)).size}</p></div>
                    <div className="w-10 h-10 bg-[#00E5FF]/20 text-[#00E5FF] rounded-lg flex items-center justify-center"><Building2 className="w-5 h-5" /></div>
                </div>
            </div>

            <Card className="glass-card bg-[#0f0f14]/50 border-white/5 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                    <CardTitle className="text-lg font-semibold text-white">Fornecedores</CardTitle>
                    <div className="flex items-center space-x-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-52 bg-black/20 border-white/10 text-white placeholder:text-slate-500" />
                        </div>
                        <Button onClick={openNewModal} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            <Plus className="w-4 h-4 mr-2" /> Novo Fornecedor
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-black/40">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-400">Nome</TableHead>
                                <TableHead className="text-slate-400">CNPJ</TableHead>
                                <TableHead className="text-slate-400">Contato</TableHead>
                                <TableHead className="text-slate-400">Categoria</TableHead>
                                <TableHead className="text-slate-400">Status</TableHead>
                                <TableHead className="text-right text-slate-400">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Carregando...</TableCell></TableRow>
                            ) : filteredSuppliers.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Nenhum fornecedor encontrado.</TableCell></TableRow>
                            ) : (
                                filteredSuppliers.map(s => (
                                    <TableRow key={s.id} className="border-white/5 hover:bg-white/[0.02] hover:shadow-[inset_4px_0_0_0_#00E5FF] transition-all">
                                        <TableCell className="font-medium text-white">
                                            {s.name}
                                            {s.contact_name && <div className="text-xs text-slate-500">{s.contact_name}</div>}
                                        </TableCell>
                                        <TableCell className="text-slate-300 font-mono text-sm">{s.cnpj || '-'}</TableCell>
                                        <TableCell className="text-slate-300 text-sm">
                                            {s.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-500" /> {s.phone}</div>}
                                            {s.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-500" /> {s.email}</div>}
                                        </TableCell>
                                        <TableCell className="text-slate-300 capitalize">{s.category || '-'}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${s.active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                                                {s.active ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => openEditModal(s)} className="text-[#00E5FF] hover:text-white hover:bg-white/10"><Edit2 className="w-4 h-4" /></Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10"><Trash2 className="w-4 h-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-300">Nome / Razão Social *</label>
                            <Input {...register('name')} placeholder="Nome da empresa..." className="mt-1 bg-black/20 border-white/10 text-white" />
                            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">CNPJ</label>
                            <Input {...register('cnpj')} placeholder="00.000.000/0000-00" className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Categoria</label>
                            <select {...register('category')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF]">
                                <option value="" className="bg-[#0f0f14]">Selecione...</option>
                                <option value="peças" className="bg-[#0f0f14]">Peças</option>
                                <option value="serviços" className="bg-[#0f0f14]">Serviços</option>
                                <option value="combustível" className="bg-[#0f0f14]">Combustível</option>
                                <option value="materiais" className="bg-[#0f0f14]">Materiais</option>
                                <option value="outros" className="bg-[#0f0f14]">Outros</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Contato (Pessoa)</label>
                            <Input {...register('contact_name')} placeholder="Nome do contato" className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Telefone</label>
                            <Input {...register('phone')} placeholder="(11) 99999-9999" className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">E-mail</label>
                            <Input {...register('email')} type="email" placeholder="contato@empresa.com" className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Endereço</label>
                            <Input {...register('address')} placeholder="Endereço completo" className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300">Observações</label>
                        <textarea {...register('notes')} rows={2} placeholder="Observações..." className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white placeholder:text-slate-600 focus:outline-none focus:ring-[#00E5FF]" />
                    </div>
                    <div className="flex items-center gap-3">
                        <input type="checkbox" {...register('active')} id="supplier_active" className="accent-[#00E5FF] w-4 h-4" />
                        <label htmlFor="supplier_active" className="text-sm text-slate-300">Fornecedor ativo</label>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="border border-white/10 text-slate-300 hover:bg-white/5">Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            {isSubmitting ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
