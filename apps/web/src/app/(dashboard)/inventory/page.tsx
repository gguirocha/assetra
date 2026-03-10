"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle, TrendingUp, DollarSign, History, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const partSchema = z.object({
    sku: z.string().optional(),
    description: z.string().min(2, 'Descrição obrigatória'),
    unit: z.string().default('un'),
    category: z.string().optional(),
    min_stock: z.coerce.number().min(0).default(0),
    current_stock: z.coerce.number().min(0).default(0),
    average_cost: z.coerce.number().min(0).default(0),
    preferred_supplier: z.string().optional(),
    supplier_id: z.string().optional(),
});

type PartFormValues = z.infer<typeof partSchema>;

export default function InventoryPage() {
    const { session } = useAuth();
    const [parts, setParts] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [filterCategory, setFilterCategory] = useState('all');

    // Movement history modal
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyPart, setHistoryPart] = useState<any>(null);
    const [historyMovements, setHistoryMovements] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PartFormValues>({
        resolver: zodResolver(partSchema) as any,
        defaultValues: { unit: 'un', min_stock: 0, current_stock: 0, average_cost: 0 }
    });

    const [kpis, setKpis] = useState({ total_items: 0, below_min: 0, total_value: 0, categories: 0 });

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('parts')
                .select('*, suppliers(name)')
                .order('description');
            if (error) throw error;
            const all = data || [];
            setParts(all);

            const belowMin = all.filter(p => p.current_stock <= p.min_stock && p.min_stock > 0);
            const totalValue = all.reduce((acc, p) => acc + (Number(p.current_stock) * Number(p.average_cost)), 0);
            const cats = new Set(all.map(p => p.category).filter(Boolean));

            setKpis({
                total_items: all.length,
                below_min: belowMin.length,
                total_value: totalValue,
                categories: cats.size
            });

            const { data: sData } = await supabase.from('suppliers').select('id, name').eq('active', true).order('name');
            if (sData) setSuppliers(sData);
        } catch (error: any) {
            // Ignore errors from missing tables (SQL not yet run)
            if (!error?.message?.includes('does not exist')) console.error(error);
        }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const onSubmit = async (data: PartFormValues) => {
        try {
            const cleanData: any = { ...data };
            if (!cleanData.supplier_id) cleanData.supplier_id = null;
            if (!cleanData.sku) cleanData.sku = null;

            if (editingId) {
                const { error } = await supabase.from('parts').update(cleanData).eq('id', editingId);
                if (error) throw error;
            } else {
                let tenant_id = null;
                if (session?.user) {
                    const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                    tenant_id = prof?.tenant_id;
                }
                const { error } = await supabase.from('parts').insert([{ ...cleanData, tenant_id }]);
                if (error) throw error;
            }
            setIsModalOpen(false);
            setEditingId(null);
            reset();
            fetchData();
        } catch (error: any) {
            alert('Erro ao salvar: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este item?')) return;
        const { error } = await supabase.from('parts').delete().eq('id', id);
        if (error) alert('Erro: ' + error.message);
        else fetchData();
    };

    const openNewModal = () => { setEditingId(null); reset({ unit: 'un', min_stock: 0, current_stock: 0, average_cost: 0 }); setIsModalOpen(true); };

    const openEditModal = (p: any) => {
        setEditingId(p.id);
        reset({
            sku: p.sku || '', description: p.description, unit: p.unit,
            category: p.category || '', min_stock: p.min_stock, current_stock: p.current_stock,
            average_cost: p.average_cost, preferred_supplier: p.preferred_supplier || '', supplier_id: p.supplier_id || ''
        });
        setIsModalOpen(true);
    };

    const isBelowMin = (p: any) => p.current_stock <= p.min_stock && p.min_stock > 0;

    const openHistory = async (part: any) => {
        setHistoryPart(part);
        setHistoryModalOpen(true);
        setHistoryLoading(true);
        const { data } = await supabase
            .from('stock_movements')
            .select('*, work_orders(os_number, description, type)')
            .eq('part_id', part.id)
            .order('date', { ascending: false })
            .limit(50);
        setHistoryMovements(data || []);
        setHistoryLoading(false);
    };

    const filteredParts = parts.filter(p => {
        const matchSearch = p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.codprod?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchCat = filterCategory === 'all' || p.category === filterCategory;
        return matchSearch && matchCat;
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Package className="w-7 h-7 text-[#00E5FF]" /> Estoque de Peças e Materiais
                </h1>
                <p className="text-slate-400 mt-1">Gerencie itens, controle de estoque mínimo e custos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Itens Cadastrados</p><p className="text-2xl font-bold text-white font-mono mt-1">{kpis.total_items}</p></div>
                    <div className="w-10 h-10 bg-[#5B5CFF]/20 text-[#5B5CFF] rounded-lg flex items-center justify-center"><Package className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Abaixo do Mínimo</p><p className="text-2xl font-bold text-red-400 font-mono mt-1">{kpis.below_min}</p></div>
                    <div className="w-10 h-10 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Valor Total Estoque</p><p className="text-2xl font-bold text-emerald-400 font-mono mt-1">R$ {kpis.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                    <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Categorias</p><p className="text-2xl font-bold text-[#00E5FF] font-mono mt-1">{kpis.categories}</p></div>
                    <div className="w-10 h-10 bg-[#00E5FF]/20 text-[#00E5FF] rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5" /></div>
                </div>
            </div>

            <Card className="glass-card bg-[#0f0f14]/50 border-white/5 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                    <CardTitle className="text-lg font-semibold text-white">Itens em Estoque</CardTitle>
                    <div className="flex items-center space-x-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-52 bg-black/20 border-white/10 text-white placeholder:text-slate-500" />
                        </div>
                        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none">
                            <option value="all" className="bg-[#0f0f14]">Todas Categorias</option>
                            <option value="veiculo" className="bg-[#0f0f14]">Veículo</option>
                            <option value="maquina" className="bg-[#0f0f14]">Máquina</option>
                            <option value="predial" className="bg-[#0f0f14]">Predial</option>
                            <option value="geral" className="bg-[#0f0f14]">Geral</option>
                        </select>
                        <Button onClick={openNewModal} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            <Plus className="w-4 h-4 mr-2" /> Novo Item
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-black/40">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-400">Cod / SKU</TableHead>
                                <TableHead className="text-slate-400">Descrição</TableHead>
                                <TableHead className="text-slate-400">Categoria</TableHead>
                                <TableHead className="text-slate-400 text-right">Estoque</TableHead>
                                <TableHead className="text-slate-400 text-right">Reservado</TableHead>
                                <TableHead className="text-slate-400 text-right">Mín.</TableHead>
                                <TableHead className="text-slate-400 text-right">Custo Méd.</TableHead>
                                <TableHead className="text-slate-400">Fornecedor</TableHead>
                                <TableHead className="text-right text-slate-400">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-400">Carregando...</TableCell></TableRow>
                            ) : filteredParts.length === 0 ? (
                                <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-400">Nenhum item encontrado.</TableCell></TableRow>
                            ) : (
                                filteredParts.map(p => (
                                    <TableRow key={p.id} className={`border-white/5 hover:bg-white/[0.02] transition-all ${isBelowMin(p) ? 'hover:shadow-[inset_4px_0_0_0_#ef4444]' : 'hover:shadow-[inset_4px_0_0_0_#00E5FF]'}`}>
                                        <TableCell className="text-slate-400 text-xs font-mono">
                                            {p.codprod && <div>{p.codprod}</div>}
                                            {p.sku && <div className="text-slate-500">{p.sku}</div>}
                                        </TableCell>
                                        <TableCell className="font-medium text-white">{p.description}</TableCell>
                                        <TableCell className="text-slate-300 capitalize">{p.category || '-'}</TableCell>
                                        <TableCell className={`text-right font-mono font-bold ${isBelowMin(p) ? 'text-red-400' : 'text-white'}`}>
                                            {Number(p.current_stock).toFixed(0)} {p.unit}
                                            {isBelowMin(p) && <AlertTriangle className="inline w-3 h-3 ml-1 text-red-400 animate-pulse" />}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-amber-400">
                                            {Number(p.reserved_stock || 0) > 0 ? Number(p.reserved_stock).toFixed(0) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right text-slate-500 font-mono">{Number(p.min_stock).toFixed(0)}</TableCell>
                                        <TableCell className="text-right text-slate-300 font-mono">R$ {Number(p.average_cost).toFixed(2)}</TableCell>
                                        <TableCell className="text-slate-300 text-sm">{p.suppliers?.name || p.preferred_supplier || '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => openHistory(p)} className="text-amber-400 hover:bg-amber-500/10" title="Histórico"><History className="w-4 h-4" /></Button>
                                            <Button variant="ghost" size="sm" onClick={() => openEditModal(p)} className="text-[#00E5FF] hover:text-white hover:bg-white/10"><Edit2 className="w-4 h-4" /></Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10"><Trash2 className="w-4 h-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Editar Item' : 'Novo Item de Estoque'}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">SKU Interno</label>
                            <Input {...register('sku')} placeholder="SKU-0001" className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Unidade</label>
                            <select {...register('unit')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF]">
                                <option value="un" className="bg-[#0f0f14]">Unidade</option>
                                <option value="pç" className="bg-[#0f0f14]">Peça</option>
                                <option value="L" className="bg-[#0f0f14]">Litro</option>
                                <option value="kg" className="bg-[#0f0f14]">Kg</option>
                                <option value="m" className="bg-[#0f0f14]">Metro</option>
                                <option value="cx" className="bg-[#0f0f14]">Caixa</option>
                                <option value="jg" className="bg-[#0f0f14]">Jogo</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300">Descrição *</label>
                        <Input {...register('description')} placeholder="Descrição do item..." className="mt-1 bg-black/20 border-white/10 text-white" />
                        {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Categoria</label>
                            <select {...register('category')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF]">
                                <option value="" className="bg-[#0f0f14]">Selecione...</option>
                                <option value="veiculo" className="bg-[#0f0f14]">Veículo</option>
                                <option value="maquina" className="bg-[#0f0f14]">Máquina</option>
                                <option value="predial" className="bg-[#0f0f14]">Predial</option>
                                <option value="geral" className="bg-[#0f0f14]">Geral</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Fornecedor</label>
                            <select {...register('supplier_id')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF]">
                                <option value="" className="bg-[#0f0f14]">Nenhum</option>
                                {suppliers.map(s => (<option key={s.id} value={s.id} className="bg-[#0f0f14]">{s.name}</option>))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Estoque Atual</label>
                            <Input type="number" step="1" {...register('current_stock')} className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Estoque Mínimo</label>
                            <Input type="number" step="1" {...register('min_stock')} className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Custo Médio (R$)</label>
                            <Input type="number" step="0.01" {...register('average_cost')} className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="border border-white/10 text-slate-300 hover:bg-white/5">Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            {isSubmitting ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Movement History Modal */}
            <Modal isOpen={historyModalOpen} onClose={() => setHistoryModalOpen(false)} title={`Histórico — ${historyPart?.description || ''}`} size="lg">
                <div className="max-h-[400px] overflow-y-auto space-y-2">
                    {historyLoading ? (
                        <p className="text-center text-slate-400 py-8">Carregando...</p>
                    ) : historyMovements.length === 0 ? (
                        <p className="text-center text-slate-500 py-8">Nenhuma movimentação encontrada para este item.</p>
                    ) : (
                        historyMovements.map(m => (
                            <div key={m.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                                m.type === 'in' ? 'bg-emerald-500/5 border-emerald-500/20' :
                                m.type === 'out' ? 'bg-red-500/5 border-red-500/20' :
                                'bg-amber-500/5 border-amber-500/20'
                            }`}>
                                <div className="flex items-center gap-3">
                                    {m.type === 'in' ? <ArrowDownCircle className="w-4 h-4 text-emerald-400" /> :
                                     m.type === 'out' ? <ArrowUpCircle className="w-4 h-4 text-red-400" /> :
                                     <TrendingUp className="w-4 h-4 text-amber-400" />}
                                    <div>
                                        <span className={`text-xs font-bold ${
                                            m.type === 'in' ? 'text-emerald-400' :
                                            m.type === 'out' ? 'text-red-400' : 'text-amber-400'
                                        }`}>
                                            {m.type === 'in' ? 'ENTRADA' : m.type === 'out' ? 'SAÍDA' : 'AJUSTE'}
                                        </span>
                                        <div className="text-sm text-white">
                                            {Number(m.quantity).toFixed(0)} un × R$ {Number(m.unit_cost).toFixed(2)}
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            {m.notes || ''}
                                            {m.work_orders && (
                                                <span className="text-[#00E5FF] ml-1">
                                                    → OS-{String(m.work_orders.os_number || '').padStart(4, '0')} ({m.work_orders.type})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-400">{new Date(m.date).toLocaleDateString('pt-BR')}</div>
                                    <div className="text-[10px] text-slate-500">{new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Modal>
        </div>
    );
}
