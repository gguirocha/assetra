"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowDownCircle, Package, Plus, Trash2 } from 'lucide-react';

interface EntryLine {
    part_id: string;
    quantity: number;
    unit_cost: number;
    partName?: string;
}

export default function StockEntryPage() {
    const { session } = useAuth();
    const [parts, setParts] = useState<any[]>([]);
    const [lines, setLines] = useState<EntryLine[]>([]);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchParts = async () => {
            const { data } = await supabase.from('parts').select('id, description, sku, unit, current_stock, average_cost').order('description');
            if (data) setParts(data);
        };
        fetchParts();
    }, []);

    const addLine = () => {
        setLines(prev => [...prev, { part_id: '', quantity: 1, unit_cost: 0 }]);
    };

    const removeLine = (index: number) => {
        setLines(prev => prev.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, field: string, value: any) => {
        setLines(prev => {
            const updated = [...prev];
            (updated[index] as any)[field] = value;
            if (field === 'part_id') {
                const part = parts.find(p => p.id === value);
                if (part) {
                    updated[index].unit_cost = Number(part.average_cost);
                    updated[index].partName = part.description;
                }
            }
            return updated;
        });
    };

    const saveEntries = async () => {
        const validLines = lines.filter(l => l.part_id && l.quantity > 0);
        if (validLines.length === 0) { alert('Adicione pelo menos um item.'); return; }

        setSaving(true);
        try {
            let tenant_id = null;
            let created_by = null;
            if (session?.user) {
                const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                tenant_id = prof?.tenant_id;
                created_by = session.user.id;
            }

            for (const line of validLines) {
                // Create stock movement
                await supabase.from('stock_movements').insert([{
                    part_id: line.part_id,
                    type: 'in',
                    quantity: line.quantity,
                    unit_cost: line.unit_cost,
                    tenant_id,
                    created_by,
                    notes: notes || 'Entrada manual',
                    date: new Date().toISOString()
                }]);

                // Update stock and avg cost
                const part = parts.find(p => p.id === line.part_id);
                if (part) {
                    const oldStock = Number(part.current_stock);
                    const newStock = oldStock + line.quantity;
                    let newAvgCost = Number(part.average_cost);
                    if (line.unit_cost > 0) {
                        const totalOldValue = oldStock * Number(part.average_cost);
                        const totalNewValue = line.quantity * line.unit_cost;
                        newAvgCost = newStock > 0 ? (totalOldValue + totalNewValue) / newStock : line.unit_cost;
                    }

                    await supabase.from('parts').update({
                        current_stock: newStock,
                        average_cost: Math.round(newAvgCost * 100) / 100
                    }).eq('id', line.part_id);

                    // Update local cache
                    part.current_stock = newStock;
                    part.average_cost = newAvgCost;
                }
            }

            alert(`✅ ${validLines.length} entrada(s) registrada(s) com sucesso!`);
            setLines([]);
            setNotes('');
            // Refresh parts
            const { data } = await supabase.from('parts').select('id, description, sku, unit, current_stock, average_cost').order('description');
            if (data) setParts(data);
        } catch (error: any) {
            alert('Erro: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const totalValue = lines.reduce((acc, l) => acc + (l.quantity * l.unit_cost), 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <ArrowDownCircle className="w-7 h-7 text-emerald-400" /> Entrada de Estoque
                </h1>
                <p className="text-slate-400 mt-1">Registre entradas manuais de peças e materiais no estoque.</p>
            </div>

            <Card className="glass-card bg-[#0f0f14]/50 border-white/5 shadow-2xl">
                <CardHeader className="border-b border-white/5 pb-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold text-white">Itens para Entrada</CardTitle>
                        <Button onClick={addLine} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0">
                            <Plus className="w-4 h-4 mr-2" /> Adicionar Item
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    {lines.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl">
                            <Package className="mx-auto w-12 h-12 text-slate-600 mb-3" />
                            <p className="text-slate-500">Nenhum item adicionado.</p>
                            <p className="text-slate-600 text-sm mt-1">Clique em "Adicionar Item" para começar.</p>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="grid grid-cols-12 gap-3 text-xs font-medium text-slate-400 uppercase tracking-wider px-2">
                                <div className="col-span-5">Item</div>
                                <div className="col-span-2">Qtde</div>
                                <div className="col-span-2">Custo Unit. (R$)</div>
                                <div className="col-span-2 text-right">Total</div>
                                <div className="col-span-1"></div>
                            </div>

                            {lines.map((line, i) => (
                                <div key={i} className="grid grid-cols-12 gap-3 items-center bg-black/20 border border-white/5 rounded-lg p-3">
                                    <div className="col-span-5">
                                        <select
                                            value={line.part_id}
                                            onChange={(e) => updateLine(i, 'part_id', e.target.value)}
                                            className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]"
                                        >
                                            <option value="" className="bg-[#0f0f14]">Selecione o item...</option>
                                            {parts.map(p => (
                                                <option key={p.id} value={p.id} className="bg-[#0f0f14]">
                                                    {p.description} ({p.current_stock} {p.unit} em estoque)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            type="number"
                                            min={1}
                                            value={line.quantity}
                                            onChange={(e) => updateLine(i, 'quantity', Number(e.target.value))}
                                            className="bg-black/30 border-white/10 text-white"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={line.unit_cost}
                                            onChange={(e) => updateLine(i, 'unit_cost', Number(e.target.value))}
                                            className="bg-black/30 border-white/10 text-white"
                                        />
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <span className="text-[#00E5FF] font-mono font-bold">R$ {(line.quantity * line.unit_cost).toFixed(2)}</span>
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <Button variant="ghost" size="sm" onClick={() => removeLine(i)} className="text-red-400 hover:bg-red-400/10">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            <div>
                                <label className="block text-sm font-medium text-slate-300">Observação / Nº NF</label>
                                <Input
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Ex: NF 12345, Compra fornecedor X..."
                                    className="mt-1 bg-black/20 border-white/10 text-white"
                                />
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                <div>
                                    <span className="text-sm text-slate-400">{lines.filter(l => l.part_id).length} item(ns)</span>
                                    <span className="mx-3 text-slate-600">•</span>
                                    <span className="text-lg font-bold text-[#00E5FF] font-mono">Total: R$ {totalValue.toFixed(2)}</span>
                                </div>
                                <Button
                                    onClick={saveEntries}
                                    disabled={saving || lines.filter(l => l.part_id).length === 0}
                                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:opacity-90 text-white border-0 px-8"
                                >
                                    <ArrowDownCircle className="w-4 h-4 mr-2" /> {saving ? 'Registrando...' : 'Registrar Entradas'}
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
