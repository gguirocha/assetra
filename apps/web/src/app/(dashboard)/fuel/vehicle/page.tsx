"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Fuel, TrendingUp, DollarSign, AlertTriangle, Gauge, BarChart3, TrendingDown, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function FuelVehiclePage() {
    const { session } = useAuth();
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [fuelings, setFuelings] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadVehicles = async () => {
            const { data } = await supabase.from('vehicles').select('id, plate, model, brand').order('plate');
            if (data) setVehicles(data);
        };
        loadVehicles();
    }, []);

    const fetchVehicleFuelings = useCallback(async (vehicleId: string) => {
        if (!vehicleId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('fuelings')
                .select('*, drivers(name)')
                .eq('vehicle_id', vehicleId)
                .order('date', { ascending: false });
            if (error) throw error;
            setFuelings(data || []);
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedVehicleId) fetchVehicleFuelings(selectedVehicleId);
        else setFuelings([]);
    }, [selectedVehicleId, fetchVehicleFuelings]);

    const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

    // KPIs
    const kpis = useMemo(() => {
        if (fuelings.length === 0) return null;
        const totalLiters = fuelings.reduce((a, f) => a + Number(f.liters), 0);
        const totalCost = fuelings.reduce((a, f) => a + Number(f.total_cost || 0), 0);
        const totalKm = fuelings.reduce((a, f) => a + Number(f.km_driven || 0), 0);
        const withConsumption = fuelings.filter(f => Number(f.consumption_km_l) > 0);
        const avgConsumption = withConsumption.length > 0
            ? withConsumption.reduce((a, f) => a + Number(f.consumption_km_l), 0) / withConsumption.length : 0;
        const withCostKm = fuelings.filter(f => Number(f.cost_per_km) > 0);
        const avgCostKm = withCostKm.length > 0
            ? withCostKm.reduce((a, f) => a + Number(f.cost_per_km), 0) / withCostKm.length : 0;
        const avgPricePerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;
        const alertsCount = fuelings.filter(f => f.alert_type).length;
        const lastOdometer = fuelings.length > 0 ? Number(fuelings[0].odometer_km) : 0;

        // Trend: compare last 3 vs previous 3
        let consumptionTrend = 0;
        if (withConsumption.length >= 6) {
            const recent = withConsumption.slice(0, 3).reduce((a, f) => a + Number(f.consumption_km_l), 0) / 3;
            const previous = withConsumption.slice(3, 6).reduce((a, f) => a + Number(f.consumption_km_l), 0) / 3;
            consumptionTrend = previous > 0 ? ((recent - previous) / previous) * 100 : 0;
        }

        return {
            total_fuelings: fuelings.length,
            total_liters: totalLiters,
            total_cost: totalCost,
            total_km: totalKm,
            avg_consumption: avgConsumption,
            avg_cost_km: avgCostKm,
            avg_price_liter: avgPricePerLiter,
            alerts_count: alertsCount,
            last_odometer: lastOdometer,
            consumption_trend: consumptionTrend
        };
    }, [fuelings]);

    // Chart data
    const chartData = useMemo(() => {
        const sorted = [...fuelings].reverse(); // oldest first
        return sorted.map(f => ({
            date: new Date(f.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            consumption: Number(f.consumption_km_l) || 0,
            costPerKm: Number(f.cost_per_km) || 0,
            pricePerLiter: Number(f.price_per_liter) || 0,
            liters: Number(f.liters),
            totalCost: Number(f.total_cost || 0),
        }));
    }, [fuelings]);

    // Simple bar chart renderer
    const renderBarChart = (data: { label: string; value: number }[], color: string, unit: string, maxOverride?: number) => {
        if (data.length === 0) return <p className="text-slate-500 text-sm text-center py-4">Sem dados</p>;
        const values = data.map(d => d.value).filter(v => v > 0);
        const max = maxOverride || Math.max(...values, 1);
        return (
            <div className="space-y-1.5">
                {data.slice(-15).map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 w-12 shrink-0 text-right font-mono">{d.label}</span>
                        <div className="flex-1 bg-black/30 rounded-full h-5 overflow-hidden relative">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 0)}%`,
                                    background: `linear-gradient(90deg, ${color}88, ${color})`
                                }}
                            />
                            {d.value > 0 && (
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-white/80">
                                    {d.value.toFixed(1)} {unit}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Fuel className="w-7 h-7 text-[#00E5FF]" /> Abastecimentos por Veículo
                    </h1>
                    <p className="text-slate-400 mt-1">Selecione um veículo para visualizar seu histórico e indicadores.</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-sm text-slate-400">Veículo:</label>
                    <select
                        value={selectedVehicleId}
                        onChange={e => setSelectedVehicleId(e.target.value)}
                        className="px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF] min-w-[250px]"
                    >
                        <option value="" className="bg-[#0f0f14]">Selecione um veículo...</option>
                        {vehicles.map(v => (
                            <option key={v.id} value={v.id} className="bg-[#0f0f14]">
                                {v.plate} - {v.brand} {v.model}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {!selectedVehicleId && (
                <div className="glass-card rounded-xl p-12 text-center border border-white/5">
                    <Fuel className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 text-lg">Selecione um veículo para visualizar os dados de abastecimento.</p>
                </div>
            )}

            {selectedVehicleId && kpis && (
                <>
                    {/* Vehicle header */}
                    <div className="glass-card rounded-xl p-4 border border-[#00E5FF]/20 bg-[#00E5FF]/5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#00E5FF]/20 rounded-lg flex items-center justify-center">
                                <Fuel className="w-6 h-6 text-[#00E5FF]" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">{selectedVehicle?.plate} — {selectedVehicle?.brand} {selectedVehicle?.model}</h2>
                                <p className="text-sm text-slate-400">
                                    {kpis.total_fuelings} abastecimentos registrados · Último KM: {kpis.last_odometer.toLocaleString('pt-BR')} km
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-3">
                        <div className="glass-card p-4 rounded-xl hover:-translate-y-1 transition-transform">
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Abastecimentos</p>
                            <p className="text-xl font-bold text-white font-mono mt-1">{kpis.total_fuelings}</p>
                        </div>
                        <div className="glass-card p-4 rounded-xl hover:-translate-y-1 transition-transform">
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Litros Total</p>
                            <p className="text-xl font-bold text-[#00E5FF] font-mono mt-1">{kpis.total_liters.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</p>
                        </div>
                        <div className="glass-card p-4 rounded-xl hover:-translate-y-1 transition-transform">
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Custo Total</p>
                            <p className="text-xl font-bold text-emerald-400 font-mono mt-1">R$ {kpis.total_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="glass-card p-4 rounded-xl hover:-translate-y-1 transition-transform">
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">KM Rodados</p>
                            <p className="text-xl font-bold text-white font-mono mt-1">{kpis.total_km.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="glass-card p-4 rounded-xl hover:-translate-y-1 transition-transform">
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Consumo Médio</p>
                            <p className="text-xl font-bold text-amber-400 font-mono mt-1 flex items-center gap-1">
                                {kpis.avg_consumption.toFixed(1)} km/L
                                {kpis.consumption_trend !== 0 && (
                                    <span className={`text-[10px] flex items-center ${kpis.consumption_trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {kpis.consumption_trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                        {Math.abs(kpis.consumption_trend).toFixed(0)}%
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="glass-card p-4 rounded-xl hover:-translate-y-1 transition-transform">
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Custo/Km</p>
                            <p className="text-xl font-bold text-purple-400 font-mono mt-1">R$ {kpis.avg_cost_km.toFixed(2)}</p>
                        </div>
                        <div className="glass-card p-4 rounded-xl hover:-translate-y-1 transition-transform">
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Preço Médio/L</p>
                            <p className="text-xl font-bold text-sky-400 font-mono mt-1">R$ {kpis.avg_price_liter.toFixed(3)}</p>
                        </div>
                        <div className="glass-card p-4 rounded-xl hover:-translate-y-1 transition-transform">
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Alertas</p>
                            <p className={`text-xl font-bold font-mono mt-1 ${kpis.alerts_count > 0 ? 'text-red-400' : 'text-slate-500'}`}>{kpis.alerts_count}</p>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Consumption chart */}
                        <Card className="glass-card bg-[#0f0f14]/50 border-white/5">
                            <CardHeader className="pb-3 border-b border-white/5">
                                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                                    <Gauge className="w-4 h-4 text-amber-400" /> Consumo (km/L) — Últimos Abastecimentos
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                {renderBarChart(
                                    chartData.map(d => ({ label: d.date, value: d.consumption })),
                                    '#f59e0b', 'km/L'
                                )}
                                {chartData.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-xs text-slate-500">
                                        <span>Melhor: {Math.max(...chartData.filter(d => d.consumption > 0).map(d => d.consumption)).toFixed(1)} km/L</span>
                                        <span>Pior: {Math.min(...chartData.filter(d => d.consumption > 0).map(d => d.consumption)).toFixed(1)} km/L</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Cost per KM chart */}
                        <Card className="glass-card bg-[#0f0f14]/50 border-white/5">
                            <CardHeader className="pb-3 border-b border-white/5">
                                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-purple-400" /> Custo por KM (R$) — Últimos Abastecimentos
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                {renderBarChart(
                                    chartData.map(d => ({ label: d.date, value: d.costPerKm })),
                                    '#a855f7', 'R$'
                                )}
                            </CardContent>
                        </Card>

                        {/* Price per liter chart */}
                        <Card className="glass-card bg-[#0f0f14]/50 border-white/5">
                            <CardHeader className="pb-3 border-b border-white/5">
                                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-emerald-400" /> Preço por Litro (R$) — Evolução
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                {renderBarChart(
                                    chartData.map(d => ({ label: d.date, value: d.pricePerLiter })),
                                    '#10b981', 'R$'
                                )}
                            </CardContent>
                        </Card>

                        {/* Volume chart */}
                        <Card className="glass-card bg-[#0f0f14]/50 border-white/5">
                            <CardHeader className="pb-3 border-b border-white/5">
                                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-[#00E5FF]" /> Volume por Abastecimento (L)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                {renderBarChart(
                                    chartData.map(d => ({ label: d.date, value: d.liters })),
                                    '#00E5FF', 'L'
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* History Table */}
                    <Card className="glass-card bg-[#0f0f14]/50 border-white/5 shadow-2xl">
                        <CardHeader className="border-b border-white/5 pb-4">
                            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-slate-400" /> Histórico Completo
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-black/40">
                                    <TableRow className="border-white/5 hover:bg-transparent">
                                        <TableHead className="text-slate-400">Data</TableHead>
                                        <TableHead className="text-slate-400">Motorista</TableHead>
                                        <TableHead className="text-slate-400">Posto</TableHead>
                                        <TableHead className="text-slate-400">Combustível</TableHead>
                                        <TableHead className="text-slate-400 text-right">Litros</TableHead>
                                        <TableHead className="text-slate-400 text-right">R$/L</TableHead>
                                        <TableHead className="text-slate-400 text-right">Valor Total</TableHead>
                                        <TableHead className="text-slate-400 text-right">KM</TableHead>
                                        <TableHead className="text-slate-400 text-right">KM Rodados</TableHead>
                                        <TableHead className="text-slate-400 text-right">km/L</TableHead>
                                        <TableHead className="text-slate-400 text-right">R$/km</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={11} className="text-center py-8 text-slate-400">Carregando...</TableCell></TableRow>
                                    ) : fuelings.length === 0 ? (
                                        <TableRow><TableCell colSpan={11} className="text-center py-8 text-slate-400">Nenhum abastecimento para este veículo.</TableCell></TableRow>
                                    ) : (
                                        fuelings.map(f => (
                                            <TableRow key={f.id} className={`border-white/5 hover:bg-white/[0.02] transition-all ${f.alert_type ? 'hover:shadow-[inset_4px_0_0_0_#ef4444]' : 'hover:shadow-[inset_4px_0_0_0_#00E5FF]'}`}>
                                                <TableCell className="text-slate-300 text-sm">{new Date(f.date).toLocaleDateString('pt-BR')}</TableCell>
                                                <TableCell className="text-slate-300 text-sm">{f.drivers?.name || '-'}</TableCell>
                                                <TableCell className="text-slate-300 text-sm">{f.station || '-'}</TableCell>
                                                <TableCell className="text-slate-300 text-sm capitalize">{f.fuel_type?.replace('_', ' ')}</TableCell>
                                                <TableCell className="text-right text-white font-mono">{Number(f.liters).toFixed(1)}</TableCell>
                                                <TableCell className="text-right text-slate-400 font-mono">R$ {Number(f.price_per_liter).toFixed(3)}</TableCell>
                                                <TableCell className="text-right text-emerald-400 font-mono font-bold">R$ {Number(f.total_cost || 0).toFixed(2)}</TableCell>
                                                <TableCell className="text-right text-slate-300 font-mono">
                                                    {Number(f.odometer_km).toLocaleString('pt-BR')}
                                                    {f.alert_type === 'km_inconsistency' && (
                                                        <span title={f.alert_message}><AlertTriangle className="inline w-3 h-3 ml-1 text-red-400 animate-pulse" /></span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-[#00E5FF] font-mono">{Number(f.km_driven) > 0 ? Number(f.km_driven).toLocaleString('pt-BR') : '-'}</TableCell>
                                                <TableCell className={`text-right font-mono font-bold ${Number(f.consumption_km_l) > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                                                    {Number(f.consumption_km_l) > 0 ? Number(f.consumption_km_l).toFixed(1) : '-'}
                                                    {f.alert_type === 'consumption_anomaly' && (
                                                        <span title={f.alert_message}><AlertTriangle className="inline w-3 h-3 ml-1 text-red-400 animate-pulse" /></span>
                                                    )}
                                                </TableCell>
                                                <TableCell className={`text-right font-mono ${Number(f.cost_per_km) > 0 ? 'text-purple-400' : 'text-slate-600'}`}>
                                                    {Number(f.cost_per_km) > 0 ? Number(f.cost_per_km).toFixed(2) : '-'}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            )}

            {selectedVehicleId && !kpis && !loading && (
                <div className="glass-card rounded-xl p-12 text-center border border-white/5">
                    <Fuel className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 text-lg">Nenhum abastecimento registrado para este veículo.</p>
                </div>
            )}
        </div>
    );
}
