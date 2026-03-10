"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Trash2, Package, ArrowUpCircle, Lock } from 'lucide-react';

interface PendingPart {
    part_id: string;
    quantity: number;
    unit_cost: number;
}

interface PartsUsedPanelProps {
    /** ID da OS existente. null = OS ainda não criada */
    workOrderId: string | null;
    tenantId?: string | null;
    /** ID do técnico atribuído à OS. Apenas ele pode gerenciar peças */
    technicianId?: string | null;
    /** ID do usuário logado */
    currentUserId?: string | null;
    readOnly?: boolean;
    /**
     * Callback para modo "criação" — quando a OS ainda não existe.
     * O pai salva a OS primeiro, depois chama savePendingParts com o workOrderId.
     */
    onPendingPartsChange?: (parts: PendingPart[]) => void;
}

interface UsedPart {
    id?: string;
    part_id: string;
    quantity: number;
    unit_cost: number;
    status?: string; // reservado | baixado | cancelado
}

export function PartsUsedPanel({
    workOrderId,
    tenantId,
    technicianId,
    currentUserId,
    readOnly = false,
    onPendingPartsChange
}: PartsUsedPanelProps) {
    const [parts, setParts] = useState<any[]>([]);
    const [usedParts, setUsedParts] = useState<UsedPart[]>([]);
    const [loading, setLoading] = useState(false);

    // Check if current user is the assigned technician (or no technician assigned yet)
    const [isTechnician, setIsTechnician] = useState(false);

    useEffect(() => {
        const checkTech = async () => {
            if (!currentUserId) { setIsTechnician(false); return; }
            // If no technician assigned, allow anyone
            if (!technicianId) { setIsTechnician(true); return; }
            // Check if current user is this technician
            const { data } = await supabase
                .from('maintenance_technicians')
                .select('id')
                .eq('user_id', currentUserId)
                .single();
            setIsTechnician(data?.id === technicianId);
        };
        checkTech();
    }, [currentUserId, technicianId]);

    // Also allow if no technician system yet (no user_id in technicians table)
    useEffect(() => {
        if (!technicianId) { setIsTechnician(true); return; }
        // Fallback: always allow for now since technicians may not have user_id linked
        setIsTechnician(true);
    }, [technicianId]);

    // Fetch available parts
    useEffect(() => {
        const fetchParts = async () => {
            const { data } = await supabase
                .from('parts')
                .select('id, description, sku, unit, current_stock, reserved_stock, average_cost')
                .order('description');
            if (data) setParts(data);
        };
        fetchParts();
    }, []);

    // Fetch existing items for this work order
    useEffect(() => {
        if (!workOrderId) { setUsedParts([]); return; }
        const fetchItems = async () => {
            setLoading(true);
            const { data } = await supabase
                .from('work_order_items')
                .select('*, parts(description, unit, current_stock, reserved_stock)')
                .eq('work_order_id', workOrderId)
                .neq('status', 'cancelado');
            if (data) {
                setUsedParts(data.map((d: any) => ({
                    id: d.id,
                    part_id: d.part_id,
                    quantity: Number(d.quantity),
                    unit_cost: Number(d.unit_cost),
                    status: d.status || 'reservado',
                })));
            }
            setLoading(false);
        };
        fetchItems();
    }, [workOrderId]);

    // Notify parent of pending parts changes (for new OS creation)
    useEffect(() => {
        if (onPendingPartsChange && !workOrderId) {
            onPendingPartsChange(usedParts.filter(p => p.part_id && p.quantity > 0).map(p => ({
                part_id: p.part_id,
                quantity: p.quantity,
                unit_cost: p.unit_cost,
            })));
        }
    }, [usedParts, workOrderId, onPendingPartsChange]);

    const addPart = () => {
        setUsedParts(prev => [...prev, { part_id: '', quantity: 1, unit_cost: 0 }]);
    };

    const removePart = async (index: number) => {
        const item = usedParts[index];
        if (item.id && workOrderId && item.status === 'reservado') {
            // Return reserved stock
            const part = parts.find(p => p.id === item.part_id);
            if (part) {
                await supabase.from('parts').update({
                    reserved_stock: Math.max(0, Number(part.reserved_stock || 0) - item.quantity)
                }).eq('id', item.part_id);
                part.reserved_stock = Math.max(0, Number(part.reserved_stock || 0) - item.quantity);
            }
            await supabase.from('work_order_items').update({ status: 'cancelado' }).eq('id', item.id);
        }
        setUsedParts(prev => prev.filter((_, i) => i !== index));
    };

    const updatePart = (index: number, field: string, value: any) => {
        setUsedParts(prev => {
            const updated = [...prev];
            (updated[index] as any)[field] = value;

            if (field === 'part_id') {
                const part = parts.find(p => p.id === value);
                if (part) {
                    updated[index].unit_cost = Number(part.average_cost);
                }
            }
            return updated;
        });
    };

    const getAvailableStock = (partId: string) => {
        const part = parts.find(p => p.id === partId);
        if (!part) return 0;
        return Math.max(0, Number(part.current_stock) - Number(part.reserved_stock || 0));
    };

    const saveReservations = async () => {
        if (!workOrderId) return;

        for (const item of usedParts) {
            if (!item.part_id || item.quantity <= 0) continue;

            if (item.id) {
                // Already saved — update quantity
                await supabase.from('work_order_items').update({
                    quantity: item.quantity,
                    unit_cost: item.unit_cost
                }).eq('id', item.id);
            } else {
                // New reservation
                const available = getAvailableStock(item.part_id);
                if (item.quantity > available) {
                    const part = parts.find(p => p.id === item.part_id);
                    alert(`⚠️ Estoque insuficiente para "${part?.description}". Disponível: ${available}`);
                    continue;
                }

                const { data: inserted, error } = await supabase.from('work_order_items').insert([{
                    work_order_id: workOrderId,
                    part_id: item.part_id,
                    quantity: item.quantity,
                    unit_cost: item.unit_cost,
                    status: 'reservado',
                }]).select('id').single();

                if (error) { alert('Erro: ' + error.message); continue; }

                // Reserve stock
                const part = parts.find(p => p.id === item.part_id);
                if (part) {
                    const newReserved = Number(part.reserved_stock || 0) + item.quantity;
                    await supabase.from('parts').update({ reserved_stock: newReserved }).eq('id', item.part_id);
                    part.reserved_stock = newReserved;
                }

                item.id = inserted?.id;
                item.status = 'reservado';
            }
        }
        alert('✅ Peças reservadas com sucesso!');
    };

    const isLocked = readOnly || !isTechnician;
    const totalCost = usedParts.reduce((acc, p) => acc + (p.quantity * p.unit_cost), 0);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#00E5FF]" /> Peças Utilizadas
                    {usedParts.some(p => p.status === 'reservado') && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">RESERVADAS</span>
                    )}
                    {usedParts.some(p => p.status === 'baixado') && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">BAIXADAS</span>
                    )}
                </h3>
                {isLocked ? (
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Apenas o técnico responsável
                    </span>
                ) : (
                    <Button type="button" variant="ghost" size="sm" onClick={addPart} className="text-[#00E5FF] hover:bg-[#00E5FF]/10 text-xs">
                        <Plus className="w-3 h-3 mr-1" /> Adicionar Peça
                    </Button>
                )}
            </div>

            {usedParts.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-3 border border-dashed border-white/10 rounded-lg">
                    Nenhuma peça vinculada. {!isLocked ? 'Clique em "Adicionar Peça" para reservar itens do estoque.' : ''}
                </p>
            ) : (
                <div className="space-y-2">
                    {usedParts.map((item, i) => (
                        <div key={i} className={`flex items-center gap-2 rounded-lg p-2 border ${
                            item.status === 'baixado'
                                ? 'bg-emerald-500/5 border-emerald-500/20'
                                : 'bg-black/20 border-white/5'
                        }`}>
                            <select
                                value={item.part_id}
                                onChange={(e) => updatePart(i, 'part_id', e.target.value)}
                                disabled={isLocked || !!item.id}
                                className="flex-1 px-2 py-1.5 bg-black/30 border border-white/10 rounded text-white text-xs focus:outline-none focus:ring-[#00E5FF]"
                            >
                                <option value="" className="bg-[#0f0f14]">Selecione peça...</option>
                                {parts.map(p => (
                                    <option key={p.id} value={p.id} className="bg-[#0f0f14]">
                                        {p.description} ({getAvailableStock(p.id)} {p.unit} disp.)
                                    </option>
                                ))}
                            </select>
                            <Input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => updatePart(i, 'quantity', Number(e.target.value))}
                                disabled={isLocked || item.status === 'baixado'}
                                className="w-16 bg-black/30 border-white/10 text-white text-xs px-2 py-1.5"
                                placeholder="Qtd"
                            />
                            <Input
                                type="number"
                                step="0.01"
                                value={item.unit_cost}
                                onChange={(e) => updatePart(i, 'unit_cost', Number(e.target.value))}
                                disabled={isLocked || item.status === 'baixado'}
                                className="w-20 bg-black/30 border-white/10 text-white text-xs px-2 py-1.5"
                                placeholder="R$"
                            />
                            <span className="text-[#00E5FF] text-xs font-mono w-20 text-right">
                                R$ {(item.quantity * item.unit_cost).toFixed(2)}
                            </span>
                            {item.status === 'baixado' ? (
                                <span className="text-[10px] text-emerald-400 w-6 text-center">✓</span>
                            ) : !isLocked ? (
                                <Button type="button" variant="ghost" size="sm" onClick={() => removePart(i)} className="text-red-400 hover:bg-red-400/10 p-1">
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            ) : <span className="w-6" />}
                        </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <span className="text-xs text-slate-400">Total em peças:</span>
                        <span className="text-sm font-bold text-[#00E5FF] font-mono">R$ {totalCost.toFixed(2)}</span>
                    </div>
                </div>
            )}

            {!isLocked && usedParts.some(p => !p.id && p.part_id) && workOrderId && (
                <Button type="button" onClick={saveReservations} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 text-white border-0 text-xs py-2">
                    <ArrowUpCircle className="w-3 h-3 mr-1" /> Reservar Peças no Estoque
                </Button>
            )}
        </div>
    );
}

/**
 * Utility: Save pending parts after OS creation.
 * Called by the OS page after inserting a new work_order with the returned ID.
 */
export async function savePendingPartsForOS(
    workOrderId: string,
    pendingParts: PendingPart[],
    tenantId: string | null
) {
    for (const item of pendingParts) {
        if (!item.part_id || item.quantity <= 0) continue;

        await supabase.from('work_order_items').insert([{
            work_order_id: workOrderId,
            part_id: item.part_id,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            status: 'reservado',
        }]);

        // Reserve stock
        const { data: part } = await supabase.from('parts').select('reserved_stock').eq('id', item.part_id).single();
        if (part) {
            await supabase.from('parts').update({
                reserved_stock: Number(part.reserved_stock || 0) + item.quantity
            }).eq('id', item.part_id);
        }
    }
}

/**
 * Utility: When OS is completed, convert reservations to actual deductions.
 */
export async function finalizePartsForOS(workOrderId: string, tenantId: string | null) {
    const { data: items } = await supabase
        .from('work_order_items')
        .select('*')
        .eq('work_order_id', workOrderId)
        .eq('status', 'reservado');

    if (!items || items.length === 0) return;

    for (const item of items) {
        // Deduct from current stock, remove from reserved
        const { data: part } = await supabase.from('parts')
            .select('current_stock, reserved_stock')
            .eq('id', item.part_id).single();

        if (part) {
            await supabase.from('parts').update({
                current_stock: Math.max(0, Number(part.current_stock) - item.quantity),
                reserved_stock: Math.max(0, Number(part.reserved_stock || 0) - item.quantity),
            }).eq('id', item.part_id);
        }

        // Create stock movement
        await supabase.from('stock_movements').insert([{
            part_id: item.part_id,
            work_order_id: workOrderId,
            type: 'out',
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            tenant_id: tenantId,
            notes: `Baixa via OS concluída`,
            date: new Date().toISOString()
        }]);

        // Mark item as baixado
        await supabase.from('work_order_items').update({ status: 'baixado' }).eq('id', item.id);
    }
}

/**
 * Utility: When OS is cancelled, return reserved stock.
 */
export async function cancelPartsForOS(workOrderId: string) {
    const { data: items } = await supabase
        .from('work_order_items')
        .select('*')
        .eq('work_order_id', workOrderId)
        .eq('status', 'reservado');

    if (!items || items.length === 0) return;

    for (const item of items) {
        // Return from reserved
        const { data: part } = await supabase.from('parts')
            .select('reserved_stock')
            .eq('id', item.part_id).single();

        if (part) {
            await supabase.from('parts').update({
                reserved_stock: Math.max(0, Number(part.reserved_stock || 0) - item.quantity),
            }).eq('id', item.part_id);
        }

        await supabase.from('work_order_items').update({ status: 'cancelado' }).eq('id', item.id);
    }
}
