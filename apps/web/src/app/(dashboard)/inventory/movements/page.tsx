"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, ArrowDownCircle, ArrowUpCircle, TrendingUp, DollarSign, Package } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const movementSchema = z.object({
    part_id: z.string().min(1, 'Selecione um item'),
    type: z.enum(['in', 'out', 'adj']),
    quantity: z.coerce.number().min(0.01, 'Quantidade obrigatória'),
    unit_cost: z.coerce.number().min(0).default(0),
    notes: z.string().optional(),
});

type MovementFormValues = z.infer<typeof movementSchema>;

export default function StockMovementsPage() {
    const { session } = useAuth();
    const [movements, setMovements] = useState<any[]>([]);
    const [parts, setParts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<MovementFormValues>({
        resolver: zodResolver(movementSchema) as any,
        defaultValues: { type: 'in', unit_cost: 0 }
    });

    const [kpis, setKpis] = useState({ entries: 0, exits: 0, value_in: 0, value_out: 0 });

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('stock_movements')
                .select('*, parts(description, sku, unit)')
                .order('date', { ascending: false })
                .limit(200);
            if (error) throw error;
            const all = data || [];
            setMovements(all);

            const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
            const monthMov = all.filter(m => m.date >= firstDay);
            setKpis({
                entries: monthMov.filter(m => m.type === 'in').length,
                exits: monthMov.filter(m => m.type === 'out').length,
                value_in: monthMov.filter(m => m.type === 'in').reduce((acc, m) => acc + (Number(m.quantity) * Number(m.unit_cost)), 0),
                value_out: monthMov.filter(m => m.type === 'out').reduce((acc, m) => acc + (Number(m.quantity) * Number(m.unit_cost)), 0)
            });

            const { data: pData } = await supabase.from('parts').select('id, description, sku, unit, current_stock, average_cost').order('description');
            if (pData) setParts(pData);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const onSubmit = async (data: MovementFormValues) => {
        try {
            let tenant_id = null;
            let created_by = null;
            if (session?.user) {
                const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                tenant_id = prof?.tenant_id;
                created_by = session.user.id;
            }

            const { error } = await supabase.from('stock_movements').insert([{
                ...data,
                tenant_id,
                created_by,
                date: new Date().toISOString()
            }]);
            if (error) throw error;

            // Update stock in parts table
            const part = parts.find(p => p.id === data.part_id);
            if (part) {
                let newStock = Number(part.current_stock);
                if (data.type === 'in') newStock += data.quantity;
                else if (data.type === 'out') newStock -= data.quantity;
                else newStock = data.quantity; // adj = set absolute

                // Recalculate average cost for entries
                let newAvgCost = Number(part.average_cost);
                if (data.type === 'in' && data.unit_cost > 0) {
                    const totalOldValue = Number(part.current_stock) * Number(part.average_cost);
                    const totalNewValue = data.quantity * data.unit_cost;
                    newAvgCost = newStock > 0 ? (totalOldValue + totalNewValue) / newStock : data.unit_cost;
                }

                await supabase.from('parts').update({
                    current_stock: Math.max(0, newStock),
                    average_cost: Math.round(newAvgCost * 100) / 100
                }).eq('id', data.part_id);
            }

            setIsModalOpen(false);
            reset();
            fetchData();
        } catch (error: any) {
            alert('Erro: ' + error.message);
        }
    };

    const getTypeStyle = (type: string) => {
        switch (type) {
            case 'in': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'out': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'adj': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };
    const getTypeLabel = (t: string) => { switch (t) { case 'in': return 'Entrada'; case 'out': return 'Saída'; case 'adj': return 'Ajuste'; default: return t; } };

    const filteredMovements = movements.filter(m => {
        const matchSearch = m.parts?.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.notes?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchType = filterType === 'all' || m.type === filterType;
        return matchSearch && matchType;
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Movimentações de Estoque</h1>
                <p className="text-slate-400 mt-1">Registre entradas, saídas e ajustes de peças e materiais.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Entradas (Mês)</p><p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{kpis.entries}</p></div>
                    <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center"><ArrowDownCircle className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Saídas (Mês)</p><p className="text-2xl font-bold text-red-400 font-mono mt-1">{kpis.exits}</p></div>
                    <div className="w-10 h-10 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center"><ArrowUpCircle className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Valor Entradas</p><p className="text-2xl font-bold text-emerald-400 font-mono mt-1">R$ {kpis.value_in.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                    <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Valor Saídas</p><p className="text-2xl font-bold text-red-400 font-mono mt-1">R$ {kpis.value_out.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                    <div className="w-10 h-10 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5" /></div>
                </div>
            </div>

            <Card className="glass-card bg-[#0f0f14]/50 border-white/5 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                    <CardTitle className="text-lg font-semibold text-white">Histórico de Movimentações</CardTitle>
                    <div className="flex items-center space-x-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-52 bg-black/20 border-white/10 text-white placeholder:text-slate-500" />
                        </div>
                        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none">
                            <option value="all" className="bg-[#0f0f14]">Todos</option>
                            <option value="in" className="bg-[#0f0f14]">Entradas</option>
                            <option value="out" className="bg-[#0f0f14]">Saídas</option>
                            <option value="adj" className="bg-[#0f0f14]">Ajustes</option>
                        </select>
                        <Button onClick={() => { reset({ type: 'in', unit_cost: 0 }); setIsModalOpen(true); }} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            <Plus className="w-4 h-4 mr-2" /> Nova Movimentação
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-black/40">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-400">Data</TableHead>
                                <TableHead className="text-slate-400">Tipo</TableHead>
                                <TableHead className="text-slate-400">Item</TableHead>
                                <TableHead className="text-slate-400 text-right">Qtde</TableHead>
                                <TableHead className="text-slate-400 text-right">Custo Unit.</TableHead>
                                <TableHead className="text-slate-400 text-right">Total</TableHead>
                                <TableHead className="text-slate-400">Observação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">Carregando...</TableCell></TableRow>
                            ) : filteredMovements.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">Nenhuma movimentação encontrada.</TableCell></TableRow>
                            ) : (
                                filteredMovements.map(m => (
                                    <TableRow key={m.id} className="border-white/5 hover:bg-white/[0.02] transition-all">
                                        <TableCell className="text-slate-400 text-sm">
                                            {new Date(m.date).toLocaleDateString('pt-BR')}
                                            <div className="text-[10px] text-slate-500">{new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeStyle(m.type)}`}>
                                                {m.type === 'in' && <ArrowDownCircle className="inline w-3 h-3 mr-1" />}
                                                {m.type === 'out' && <ArrowUpCircle className="inline w-3 h-3 mr-1" />}
                                                {getTypeLabel(m.type)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-medium text-white">{m.parts?.description || '-'}</TableCell>
                                        <TableCell className="text-right font-mono text-white">{Number(m.quantity).toFixed(0)}</TableCell>
                                        <TableCell className="text-right font-mono text-slate-300">R$ {Number(m.unit_cost).toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono font-bold text-[#00E5FF]">R$ {(Number(m.quantity) * Number(m.unit_cost)).toFixed(2)}</TableCell>
                                        <TableCell className="text-slate-400 text-sm max-w-[200px] truncate">{m.notes || '-'}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Movimentação">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300">Item *</label>
                        <select {...register('part_id')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF]">
                            <option value="" className="bg-[#0f0f14]">Selecione um item...</option>
                            {parts.map(p => (<option key={p.id} value={p.id} className="bg-[#0f0f14]">{p.description} (Estoque: {p.current_stock} {p.unit})</option>))}
                        </select>
                        {errors.part_id && <p className="text-red-400 text-xs mt-1">{errors.part_id.message}</p>}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Tipo *</label>
                            <select {...register('type')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF]">
                                <option value="in" className="bg-[#0f0f14]">Entrada (Compra)</option>
                                <option value="out" className="bg-[#0f0f14]">Saída (OS / Uso)</option>
                                <option value="adj" className="bg-[#0f0f14]">Ajuste (Inventário)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Quantidade *</label>
                            <Input type="number" step="1" {...register('quantity')} className="mt-1 bg-black/20 border-white/10 text-white" />
                            {errors.quantity && <p className="text-red-400 text-xs mt-1">{errors.quantity.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Custo Unitário (R$)</label>
                            <Input type="number" step="0.01" {...register('unit_cost')} className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300">Observação</label>
                        <Input {...register('notes')} placeholder="NF, OS, motivo do ajuste..." className="mt-1 bg-black/20 border-white/10 text-white" />
                    </div>
                    <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="border border-white/10 text-slate-300 hover:bg-white/5">Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            {isSubmitting ? 'Registrando...' : 'Registrar'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
