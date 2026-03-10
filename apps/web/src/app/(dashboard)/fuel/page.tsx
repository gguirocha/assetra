"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, Fuel, TrendingUp, DollarSign, AlertTriangle, Gauge, BarChart3 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const fuelingSchema = z.object({
    vehicle_id: z.string().min(1, 'Veículo obrigatório'),
    driver_id: z.string().optional(),
    date: z.string().optional(),
    station: z.string().optional(),
    fuel_type: z.string().default('diesel'),
    liters: z.coerce.number().min(0.01, 'Litros obrigatório'),
    price_per_liter: z.coerce.number().min(0.01, 'Preço por litro obrigatório'),
    odometer_km: z.coerce.number().min(0, 'KM obrigatório'),
    is_full_tank: z.boolean().default(true),
    notes: z.string().optional(),
});

type FuelingFormValues = z.infer<typeof fuelingSchema>;

export default function FuelManagementPage() {
    const { session } = useAuth();
    const [fuelings, setFuelings] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [filterVehicle, setFilterVehicle] = useState('all');

    const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FuelingFormValues>({
        resolver: zodResolver(fuelingSchema) as any,
        defaultValues: { fuel_type: 'diesel', is_full_tank: true, liters: 0, price_per_liter: 0, odometer_km: 0 }
    });

    const litersWatch = watch('liters');
    const pricePerLiterWatch = watch('price_per_liter');
    const totalCostCalc = litersWatch > 0 && pricePerLiterWatch > 0 ? litersWatch * pricePerLiterWatch : 0;

    const [kpis, setKpis] = useState({
        total_fuelings: 0,
        total_liters: 0,
        total_cost: 0,
        avg_consumption: 0,
        avg_cost_km: 0,
        alerts_count: 0
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: vData } = await supabase.from('vehicles').select('id, plate, model, brand').order('plate');
            if (vData) setVehicles(vData);

            const { data: dData } = await supabase.from('drivers').select('id, name').eq('active', true).order('name');
            if (dData) setDrivers(dData);

            const { data, error } = await supabase
                .from('fuelings')
                .select('*, vehicles(plate, model, brand), drivers(name)')
                .order('date', { ascending: false });
            if (error) throw error;
            const all = data || [];
            setFuelings(all);

            // KPIs
            const totalLiters = all.reduce((a, f) => a + Number(f.liters), 0);
            const totalCost = all.reduce((a, f) => a + Number(f.total_cost || 0), 0);
            const withConsumption = all.filter(f => Number(f.consumption_km_l) > 0);
            const avgConsumption = withConsumption.length > 0
                ? withConsumption.reduce((a, f) => a + Number(f.consumption_km_l), 0) / withConsumption.length : 0;
            const withCostKm = all.filter(f => Number(f.cost_per_km) > 0);
            const avgCostKm = withCostKm.length > 0
                ? withCostKm.reduce((a, f) => a + Number(f.cost_per_km), 0) / withCostKm.length : 0;
            const alertsCount = all.filter(f => f.alert_type).length;

            setKpis({
                total_fuelings: all.length,
                total_liters: totalLiters,
                total_cost: totalCost,
                avg_consumption: avgConsumption,
                avg_cost_km: avgCostKm,
                alerts_count: alertsCount
            });
        } catch (error: any) {
            if (!error?.message?.includes('does not exist')) console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const detectAlerts = async (vehicleId: string, odometerKm: number, liters: number, consumption: number) => {
        let alertType: string | null = null;
        let alertMessage: string | null = null;

        const { data: lastFueling } = await supabase
            .from('fuelings')
            .select('odometer_km, consumption_km_l')
            .eq('vehicle_id', vehicleId)
            .order('date', { ascending: false })
            .limit(1)
            .single();

        if (lastFueling) {
            if (odometerKm <= Number(lastFueling.odometer_km)) {
                alertType = 'km_inconsistency';
                alertMessage = `⚠️ KM informado (${odometerKm}) é menor ou igual ao último registro (${lastFueling.odometer_km} km).`;
            }
        }

        if (!alertType && consumption > 0) {
            const { data: avgData } = await supabase
                .from('fuelings')
                .select('consumption_km_l')
                .eq('vehicle_id', vehicleId)
                .gt('consumption_km_l', 0)
                .limit(10);

            if (avgData && avgData.length >= 3) {
                const avgConsumption = avgData.reduce((a, f) => a + Number(f.consumption_km_l), 0) / avgData.length;
                const deviation = Math.abs(consumption - avgConsumption) / avgConsumption;
                if (deviation > 0.3) {
                    alertType = 'consumption_anomaly';
                    alertMessage = `⚠️ Consumo (${consumption.toFixed(1)} km/L) desvia ${(deviation * 100).toFixed(0)}% da média do veículo (${avgConsumption.toFixed(1)} km/L).`;
                }
            }
        }

        return { alertType, alertMessage };
    };

    const onSubmit = async (data: FuelingFormValues) => {
        try {
            // Find previous odometer
            const { data: lastFueling } = await supabase
                .from('fuelings')
                .select('odometer_km')
                .eq('vehicle_id', data.vehicle_id)
                .order('date', { ascending: false })
                .limit(1)
                .single();

            const previousOdometer = lastFueling ? Number(lastFueling.odometer_km) : 0;

            const kmDriven = previousOdometer > 0 && data.odometer_km > previousOdometer
                ? data.odometer_km - previousOdometer : 0;
            const consumption = data.liters > 0 && kmDriven > 0 ? kmDriven / data.liters : 0;

            const alerts = await detectAlerts(data.vehicle_id, data.odometer_km, data.liters, consumption);

            const payload: any = {
                vehicle_id: data.vehicle_id,
                driver_id: data.driver_id || null,
                date: data.date || new Date().toISOString(),
                station: data.station || null,
                fuel_type: data.fuel_type,
                liters: data.liters,
                price_per_liter: data.price_per_liter,
                odometer_km: data.odometer_km,
                is_full_tank: data.is_full_tank,
                notes: data.notes || null,
                alert_type: alerts.alertType,
                alert_message: alerts.alertMessage,
            };

            if (editingId) {
                const { error } = await supabase.from('fuelings').update(payload).eq('id', editingId);
                if (error) throw error;
            } else {
                payload.previous_odometer_km = previousOdometer;
                let tenant_id = null;
                if (session?.user) {
                    const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                    tenant_id = prof?.tenant_id;
                }
                payload.tenant_id = tenant_id;
                const { error } = await supabase.from('fuelings').insert([payload]);
                if (error) throw error;
            }

            if (alerts.alertType) {
                alert(`⚠️ Alerta detectado:\n${alerts.alertMessage}`);
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
        if (!confirm('Excluir este abastecimento?')) return;
        const { error } = await supabase.from('fuelings').delete().eq('id', id);
        if (error) alert('Erro: ' + error.message);
        else fetchData();
    };

    const openNewModal = () => {
        setEditingId(null);
        reset({ fuel_type: 'diesel', is_full_tank: true, liters: 0, price_per_liter: 0, odometer_km: 0 });
        setIsModalOpen(true);
    };

    const openEditModal = (f: any) => {
        setEditingId(f.id);
        reset({
            vehicle_id: f.vehicle_id,
            driver_id: f.driver_id || '',
            date: f.date ? new Date(f.date).toISOString().slice(0, 16) : '',
            station: f.station || '',
            fuel_type: f.fuel_type,
            liters: Number(f.liters),
            price_per_liter: Number(f.price_per_liter),
            odometer_km: Number(f.odometer_km),
            is_full_tank: f.is_full_tank,
            notes: f.notes || '',
        });
        setIsModalOpen(true);
    };

    const filteredFuelings = fuelings.filter(f => {
        const matchSearch = f.vehicles?.plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.drivers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.station?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchVehicle = filterVehicle === 'all' || f.vehicle_id === filterVehicle;
        return matchSearch && matchVehicle;
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Fuel className="w-7 h-7 text-[#00E5FF]" /> Gestão de Abastecimentos
                </h1>
                <p className="text-slate-400 mt-1">Registre abastecimentos, acompanhe consumo e custos por veículo.</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Abastecimentos</p><p className="text-2xl font-bold text-white font-mono mt-1">{kpis.total_fuelings}</p></div>
                    <div className="w-10 h-10 bg-[#5B5CFF]/20 text-[#5B5CFF] rounded-lg flex items-center justify-center"><Fuel className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Litros Total</p><p className="text-2xl font-bold text-[#00E5FF] font-mono mt-1">{kpis.total_liters.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</p></div>
                    <div className="w-10 h-10 bg-[#00E5FF]/20 text-[#00E5FF] rounded-lg flex items-center justify-center"><BarChart3 className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Custo Total</p><p className="text-2xl font-bold text-emerald-400 font-mono mt-1">R$ {kpis.total_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                    <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Consumo Médio</p><p className="text-2xl font-bold text-amber-400 font-mono mt-1">{kpis.avg_consumption.toFixed(1)} km/L</p></div>
                    <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-lg flex items-center justify-center"><Gauge className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Custo/Km</p><p className="text-2xl font-bold text-purple-400 font-mono mt-1">R$ {kpis.avg_cost_km.toFixed(2)}</p></div>
                    <div className="w-10 h-10 bg-purple-500/20 text-purple-400 rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5" /></div>
                </div>
                <div className="glass-card p-5 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform">
                    <div><p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Alertas</p><p className={`text-2xl font-bold font-mono mt-1 ${kpis.alerts_count > 0 ? 'text-red-400' : 'text-slate-500'}`}>{kpis.alerts_count}</p></div>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpis.alerts_count > 0 ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-500'}`}><AlertTriangle className="w-5 h-5" /></div>
                </div>
            </div>

            {/* Table */}
            <Card className="glass-card bg-[#0f0f14]/50 border-white/5 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                    <CardTitle className="text-lg font-semibold text-white">Registros de Abastecimento</CardTitle>
                    <div className="flex items-center space-x-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-48 bg-black/20 border-white/10 text-white placeholder:text-slate-500" />
                        </div>
                        <select value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)} className="px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none">
                            <option value="all" className="bg-[#0f0f14]">Todos Veículos</option>
                            {vehicles.map(v => (<option key={v.id} value={v.id} className="bg-[#0f0f14]">{v.plate} - {v.model}</option>))}
                        </select>
                        <Button onClick={openNewModal} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 text-white border-0 glow-primary">
                            <Plus className="w-4 h-4 mr-2" /> Novo Abastecimento
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-black/40">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-400">Data</TableHead>
                                <TableHead className="text-slate-400">Veículo</TableHead>
                                <TableHead className="text-slate-400">Motorista</TableHead>
                                <TableHead className="text-slate-400">Posto</TableHead>
                                <TableHead className="text-slate-400">Combustível</TableHead>
                                <TableHead className="text-slate-400 text-right">Litros</TableHead>
                                <TableHead className="text-slate-400 text-right">R$/L</TableHead>
                                <TableHead className="text-slate-400 text-right">Valor Total</TableHead>
                                <TableHead className="text-slate-400 text-right">KM</TableHead>
                                <TableHead className="text-slate-400 text-right">km/L</TableHead>
                                <TableHead className="text-slate-400 text-right">R$/km</TableHead>
                                <TableHead className="text-right text-slate-400">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={12} className="text-center py-8 text-slate-400">Carregando...</TableCell></TableRow>
                            ) : filteredFuelings.length === 0 ? (
                                <TableRow><TableCell colSpan={12} className="text-center py-8 text-slate-400">Nenhum abastecimento registrado.</TableCell></TableRow>
                            ) : (
                                filteredFuelings.map(f => (
                                    <TableRow key={f.id} className={`border-white/5 hover:bg-white/[0.02] transition-all ${f.alert_type ? 'hover:shadow-[inset_4px_0_0_0_#ef4444]' : 'hover:shadow-[inset_4px_0_0_0_#00E5FF]'}`}>
                                        <TableCell className="text-slate-300 text-sm">{new Date(f.date).toLocaleDateString('pt-BR')}</TableCell>
                                        <TableCell className="font-medium text-white">
                                            {f.vehicles?.plate || '-'}
                                            <div className="text-[11px] text-slate-500">{f.vehicles?.model}</div>
                                        </TableCell>
                                        <TableCell className="text-slate-300 text-sm">{f.drivers?.name || '-'}</TableCell>
                                        <TableCell className="text-slate-300 text-sm">{f.station || '-'}</TableCell>
                                        <TableCell className="text-slate-300 text-sm capitalize">{f.fuel_type?.replace('_', ' ')}</TableCell>
                                        <TableCell className="text-right text-white font-mono">{Number(f.liters).toFixed(1)}</TableCell>
                                        <TableCell className="text-right text-slate-400 font-mono">R$ {Number(f.price_per_liter).toFixed(3)}</TableCell>
                                        <TableCell className="text-right text-emerald-400 font-mono font-bold">R$ {Number(f.total_cost || 0).toFixed(2)}</TableCell>
                                        <TableCell className="text-right text-slate-300 font-mono">
                                            {Number(f.odometer_km).toLocaleString('pt-BR')}
                                            {f.alert_type === 'km_inconsistency' && <span title={f.alert_message}><AlertTriangle className="inline w-3 h-3 ml-1 text-red-400 animate-pulse" /></span>}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono font-bold ${Number(f.consumption_km_l) > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                                            {Number(f.consumption_km_l) > 0 ? Number(f.consumption_km_l).toFixed(1) : '-'}
                                            {f.alert_type === 'consumption_anomaly' && <span title={f.alert_message}><AlertTriangle className="inline w-3 h-3 ml-1 text-red-400 animate-pulse" /></span>}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono ${Number(f.cost_per_km) > 0 ? 'text-purple-400' : 'text-slate-600'}`}>
                                            {Number(f.cost_per_km) > 0 ? Number(f.cost_per_km).toFixed(2) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => openEditModal(f)} className="text-[#00E5FF] hover:text-white hover:bg-white/10"><Edit2 className="w-4 h-4" /></Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(f.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10"><Trash2 className="w-4 h-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Editar Abastecimento' : 'Novo Abastecimento'}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Veículo *</label>
                            <select {...register('vehicle_id')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF]">
                                <option value="" className="bg-[#0f0f14]">Selecione...</option>
                                {vehicles.map(v => (<option key={v.id} value={v.id} className="bg-[#0f0f14]">{v.plate} - {v.model}</option>))}
                            </select>
                            {errors.vehicle_id && <p className="text-red-400 text-xs mt-1">{errors.vehicle_id.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Motorista</label>
                            <select {...register('driver_id')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF]">
                                <option value="" className="bg-[#0f0f14]">Selecione o motorista...</option>
                                {drivers.map(d => (<option key={d.id} value={d.id} className="bg-[#0f0f14]">{d.name}</option>))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Data / Hora</label>
                            <Input type="datetime-local" {...register('date')} className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Posto</label>
                            <Input {...register('station')} placeholder="Nome do posto" className="mt-1 bg-black/20 border-white/10 text-white" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Tipo Combustível</label>
                            <select {...register('fuel_type')} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-[#00E5FF]">
                                <option value="diesel" className="bg-[#0f0f14]">Diesel</option>
                                <option value="diesel_s10" className="bg-[#0f0f14]">Diesel S10</option>
                                <option value="gasolina" className="bg-[#0f0f14]">Gasolina</option>
                                <option value="gasolina_aditivada" className="bg-[#0f0f14]">Gasolina Aditivada</option>
                                <option value="etanol" className="bg-[#0f0f14]">Etanol</option>
                                <option value="gnv" className="bg-[#0f0f14]">GNV</option>
                                <option value="arla" className="bg-[#0f0f14]">Arla 32</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Litros *</label>
                            <Input type="number" step="0.01" {...register('liters')} placeholder="Ex: 150.00" className="mt-1 bg-black/20 border-white/10 text-white" />
                            {errors.liters && <p className="text-red-400 text-xs mt-1">{errors.liters.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Preço por Litro (R$) *</label>
                            <Input type="number" step="0.001" {...register('price_per_liter')} placeholder="Ex: 5.899" className="mt-1 bg-black/20 border-white/10 text-white" />
                            {errors.price_per_liter && <p className="text-red-400 text-xs mt-1">{errors.price_per_liter.message}</p>}
                        </div>
                    </div>

                    {/* Computed total cost */}
                    {totalCostCalc > 0 && (
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 flex items-center justify-between">
                            <span className="text-sm text-slate-400">Valor Total do Abastecimento:</span>
                            <span className="text-lg font-bold text-emerald-400 font-mono">R$ {totalCostCalc.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Hodômetro (KM) *</label>
                            <Input type="number" step="0.1" {...register('odometer_km')} placeholder="Ex: 125430" className="mt-1 bg-black/20 border-white/10 text-white" />
                            {errors.odometer_km && <p className="text-red-400 text-xs mt-1">{errors.odometer_km.message}</p>}
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer pb-2">
                                <input type="checkbox" {...register('is_full_tank')} className="w-4 h-4 rounded bg-black/30 border-white/20 text-[#00E5FF] focus:ring-[#00E5FF]" />
                                <span className="text-sm text-slate-300">Tanque cheio</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300">Observações</label>
                        <textarea
                            {...register('notes')}
                            rows={2}
                            className="mt-1 block w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white placeholder:text-slate-600 focus:outline-none focus:ring-[#00E5FF]"
                            placeholder="Observações adicionais..."
                        />
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
