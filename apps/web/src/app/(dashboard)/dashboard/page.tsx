"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Wrench, Truck, AlertTriangle, Package, Fuel, Droplets, Building2, Cog,
    Clock, CheckCircle, XCircle, TrendingUp, DollarSign, Users, FileWarning,
    Calendar, ShieldAlert, BarChart3, ArrowDownRight, ArrowUpRight, Gauge
} from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';

const PERIOD_PRESETS = [
    { label: 'Mês Atual', key: 'current_month' },
    { label: 'Mês Anterior', key: 'last_month' },
    { label: 'Últimos 90 dias', key: 'last_90' },
    { label: 'Ano Atual', key: 'current_year' },
    { label: 'Personalizado', key: 'custom' },
];

function getDateRange(presetKey: string): { start: Date; end: Date } {
    const now = new Date();
    switch (presetKey) {
        case 'current_month':
            return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
        case 'last_month': {
            const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            return { start: s, end: e };
        }
        case 'last_90':
            return { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), end: now };
        case 'current_year':
            return { start: new Date(now.getFullYear(), 0, 1), end: now };
        default:
            return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    }
}

const PIE_COLORS = ['#5B5CFF', '#00E5FF', '#f59e0b', '#10b981', '#ef4444', '#a855f7'];

export default function DashboardPage() {
    const { session } = useAuth();
    const [periodKey, setPeriodKey] = useState('current_month');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [loading, setLoading] = useState(true);

    // Data stores
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [allWorkOrders, setAllWorkOrders] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [parts, setParts] = useState<any[]>([]);
    const [fuelings, setFuelings] = useState<any[]>([]);
    const [carWash, setCarWash] = useState<any[]>([]);
    const [vehicleDocs, setVehicleDocs] = useState<any[]>([]);
    const [driverDocs, setDriverDocs] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [technicians, setTechnicians] = useState<any[]>([]);

    const dateRange = useMemo(() => {
        if (periodKey === 'custom' && customStart && customEnd) {
            return { start: new Date(customStart), end: new Date(customEnd + 'T23:59:59') };
        }
        return getDateRange(periodKey);
    }, [periodKey, customStart, customEnd]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const startISO = dateRange.start.toISOString();
        const endISO = dateRange.end.toISOString();

        try {
            const [
                { data: woAll }, { data: woFiltered },
                { data: vData }, { data: pData },
                { data: fData }, { data: cwData },
                { data: vdData }, { data: ddData },
                { data: drData }, { data: tData }
            ] = await Promise.all([
                supabase.from('work_orders').select('id, type, status, priority, opening_date, completion_date, time_spent_hours, labor_cost, parts_cost, third_party_cost, technician_id').order('opening_date', { ascending: false }),
                supabase.from('work_orders').select('id, type, status, priority, opening_date, completion_date, time_spent_hours, labor_cost, parts_cost, third_party_cost, technician_id, description, vehicles(plate, model), assets_machines(name), assets_facilities(name)').gte('opening_date', startISO).lte('opening_date', endISO).order('opening_date', { ascending: false }),
                supabase.from('vehicles').select('id, plate, model, brand, status, type'),
                supabase.from('parts').select('id, description, current_stock, min_stock, reserved_stock, average_cost'),
                supabase.from('fuelings').select('id, vehicle_id, liters, price_per_liter, total_cost, consumption_km_l, cost_per_km, date, fuel_type, vehicles(plate)').gte('date', startISO).lte('date', endISO).order('date', { ascending: false }),
                supabase.from('car_wash_schedules').select('id, vehicle_id, status, scheduled_date, wash_type, vehicles(plate)').gte('scheduled_date', startISO).lte('scheduled_date', endISO),
                supabase.from('vehicle_documents').select('id, vehicle_id, type, expiration_date, vehicles(plate)').order('expiration_date'),
                supabase.from('driver_documents').select('id, driver_id, type, expiration_date, drivers(name)').order('expiration_date'),
                supabase.from('drivers').select('id, name, cnh_expiration, active'),
                supabase.from('maintenance_technicians').select('id, name, active'),
            ]);

            setAllWorkOrders(woAll || []);
            setWorkOrders(woFiltered || []);
            setVehicles(vData || []);
            setParts(pData || []);
            setFuelings(fData || []);
            setCarWash(cwData || []);
            setVehicleDocs(vdData || []);
            setDriverDocs(ddData || []);
            setDrivers(drData || []);
            setTechnicians(tData || []);
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [dateRange]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ======== COMPUTED KPIs ========
    // OS
    const openOS = allWorkOrders.filter(o => ['aberta', 'em_atendimento', 'pecas'].includes(o.status));
    const osInPeriod = workOrders;
    const osCompleted = osInPeriod.filter(o => o.status === 'concluida');
    const osCancelled = osInPeriod.filter(o => o.status === 'cancelada');
    const osVehicle = osInPeriod.filter(o => o.type === 'vehicle');
    const osMachine = osInPeriod.filter(o => o.type === 'machine');
    const osFacility = osInPeriod.filter(o => o.type === 'facility');
    const osUrgent = openOS.filter(o => o.priority === 'urgente' || o.priority === 'alta');
    const avgTimeHours = osCompleted.length > 0 ? osCompleted.reduce((a, o) => a + Number(o.time_spent_hours || 0), 0) / osCompleted.length : 0;
    const totalMaintenanceCost = osInPeriod.reduce((a, o) => a + Number(o.labor_cost || 0) + Number(o.parts_cost || 0) + Number(o.third_party_cost || 0), 0);

    // OS by status for pie
    const osByStatus = [
        { name: 'Abertas', value: osInPeriod.filter(o => o.status === 'aberta').length },
        { name: 'Em Atendimento', value: osInPeriod.filter(o => o.status === 'em_atendimento').length },
        { name: 'Peças', value: osInPeriod.filter(o => o.status === 'pecas').length },
        { name: 'Concluídas', value: osCompleted.length },
        { name: 'Canceladas', value: osCancelled.length },
    ].filter(d => d.value > 0);

    // OS by priority
    const osByPriority = [
        { name: 'Baixa', value: osInPeriod.filter(o => o.priority === 'baixa').length },
        { name: 'Média', value: osInPeriod.filter(o => o.priority === 'media').length },
        { name: 'Alta', value: osInPeriod.filter(o => o.priority === 'alta').length },
        { name: 'Urgente', value: osInPeriod.filter(o => o.priority === 'urgente').length },
    ].filter(d => d.value > 0);

    // OS by type
    const osByType = [
        { name: 'Veículos', value: osVehicle.length, color: '#5B5CFF' },
        { name: 'Máquinas', value: osMachine.length, color: '#00E5FF' },
        { name: 'Predial', value: osFacility.length, color: '#f59e0b' },
    ].filter(d => d.value > 0);

    // Documents expiring in 30 days
    const today = new Date();
    const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringVehicleDocs = vehicleDocs.filter(d => {
        const exp = new Date(d.expiration_date);
        return exp <= in30 && exp >= new Date(today.toDateString());
    });
    const expiredVehicleDocs = vehicleDocs.filter(d => new Date(d.expiration_date) < new Date(today.toDateString()));
    const expiringDriverDocs = driverDocs.filter(d => {
        const exp = new Date(d.expiration_date);
        return exp <= in30 && exp >= new Date(today.toDateString());
    });
    const expiredDriverDocs = driverDocs.filter(d => new Date(d.expiration_date) < new Date(today.toDateString()));
    const driversCNHExpiring = drivers.filter(d => d.cnh_expiration && new Date(d.cnh_expiration) <= in30 && new Date(d.cnh_expiration) >= new Date(today.toDateString()));
    const driversCNHExpired = drivers.filter(d => d.cnh_expiration && new Date(d.cnh_expiration) < new Date(today.toDateString()));
    const totalDocsExpiring = expiringVehicleDocs.length + expiringDriverDocs.length + driversCNHExpiring.length;
    const totalDocsExpired = expiredVehicleDocs.length + expiredDriverDocs.length + driversCNHExpired.length;

    // Stock
    const lowStockParts = parts.filter(p => Number(p.current_stock) <= Number(p.min_stock) && Number(p.min_stock) > 0);
    const totalStockValue = parts.reduce((a, p) => a + Number(p.current_stock) * Number(p.average_cost), 0);
    const totalReserved = parts.reduce((a, p) => a + Number(p.reserved_stock || 0), 0);

    // Fuel
    const fuelTotalCost = fuelings.reduce((a, f) => a + Number(f.total_cost || 0), 0);
    const fuelTotalLiters = fuelings.reduce((a, f) => a + Number(f.liters), 0);
    const fuelWithConsumption = fuelings.filter(f => Number(f.consumption_km_l) > 0);
    const fuelAvgConsumption = fuelWithConsumption.length > 0
        ? fuelWithConsumption.reduce((a, f) => a + Number(f.consumption_km_l), 0) / fuelWithConsumption.length : 0;
    const fuelAvgCostKm = fuelings.filter(f => Number(f.cost_per_km) > 0).length > 0
        ? fuelings.filter(f => Number(f.cost_per_km) > 0).reduce((a, f) => a + Number(f.cost_per_km), 0) / fuelings.filter(f => Number(f.cost_per_km) > 0).length : 0;

    // Car wash
    const cwCompleted = carWash.filter(c => c.status === 'concluida').length;
    const cwPending = carWash.filter(c => c.status === 'agendada' || c.status === 'em_execucao').length;
    const cwCancelled = carWash.filter(c => c.status === 'cancelada').length;

    // Fleet
    const vehiclesActive = vehicles.filter(v => v.status === 'ativo' || v.status === 'disponivel' || !v.status).length;
    const vehiclesInMaint = vehicles.filter(v => v.status === 'manutencao').length;
    const vehiclesInactive = vehicles.filter(v => v.status === 'inativo' || v.status === 'baixado').length;

    // Technicians
    const activeTechnicians = technicians.filter(t => t.active).length;

    // OS per day chart
    const osPerDay = useMemo(() => {
        const map: Record<string, number> = {};
        workOrders.forEach(o => {
            const d = new Date(o.opening_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            map[d] = (map[d] || 0) + 1;
        });
        return Object.entries(map).reverse().slice(0, 15).reverse().map(([name, OS]) => ({ name, OS }));
    }, [workOrders]);

    // Fuel cost per day
    const fuelPerDay = useMemo(() => {
        const map: Record<string, number> = {};
        fuelings.forEach(f => {
            const d = new Date(f.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            map[d] = (map[d] || 0) + Number(f.total_cost || 0);
        });
        return Object.entries(map).reverse().slice(0, 15).reverse().map(([name, Custo]) => ({ name, Custo: Math.round(Custo * 100) / 100 }));
    }, [fuelings]);

    const tooltipStyle = {
        backgroundColor: 'rgba(15,15,20,0.95)',
        borderColor: 'rgba(91,92,255,0.2)',
        borderRadius: '8px',
        backdropFilter: 'blur(8px)',
        color: '#fff'
    };
    const tickStyle = { fill: '#94a3b8', fontSize: 11, fontFamily: 'var(--font-jetbrains)' };

    const KpiCard = ({ label, value, icon: Icon, color, subtext }: any) => (
        <div className="glass-card p-4 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-transform cursor-default">
            <div className="min-w-0">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">{label}</p>
                <p className={`text-xl font-bold font-mono mt-1 ${color || 'text-white'}`}>{value}</p>
                {subtext && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{subtext}</p>}
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ml-2 ${color?.includes('red') ? 'bg-red-500/20 text-red-400' : color?.includes('amber') ? 'bg-amber-500/20 text-amber-400' : color?.includes('emerald') ? 'bg-emerald-500/20 text-emerald-400' : color?.includes('purple') ? 'bg-purple-500/20 text-purple-400' : color?.includes('00E5FF') ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'bg-[#5B5CFF]/20 text-[#5B5CFF]'}`}>
                <Icon className="w-4 h-4" />
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Visão Geral</h1>
                    <p className="text-slate-400 mt-1">Painel centralizado de todos os módulos da operação.</p>
                </div>
                {/* Period filter */}
                <div className="flex items-center gap-2 flex-wrap">
                    {PERIOD_PRESETS.filter(p => p.key !== 'custom').map(p => (
                        <Button
                            key={p.key}
                            size="sm"
                            variant={periodKey === p.key ? 'primary' : 'ghost'}
                            onClick={() => setPeriodKey(p.key)}
                            className={periodKey === p.key
                                ? 'bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] text-white border-0 text-xs'
                                : 'border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white text-xs'}
                        >
                            {p.label}
                        </Button>
                    ))}
                    <div className="flex items-center gap-1">
                        <input
                            type="date"
                            value={customStart}
                            onChange={e => { setCustomStart(e.target.value); setPeriodKey('custom'); }}
                            className="px-2 py-1 bg-black/30 border border-white/10 rounded text-white text-xs focus:outline-none focus:ring-[#00E5FF] w-[120px]"
                        />
                        <span className="text-slate-500 text-xs">a</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={e => { setCustomEnd(e.target.value); setPeriodKey('custom'); }}
                            className="px-2 py-1 bg-black/30 border border-white/10 rounded text-white text-xs focus:outline-none focus:ring-[#00E5FF] w-[120px]"
                        />
                    </div>
                </div>
            </div>

            {loading && <p className="text-slate-400 text-center py-8 animate-pulse">Carregando dados...</p>}

            {!loading && (
                <>
                    {/* ====== ROW 1: Alertas Críticos ====== */}
                    {(openOS.length > 0 || osUrgent.length > 0 || totalDocsExpired > 0 || lowStockParts.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <KpiCard label="OS Abertas (Total)" value={openOS.length} icon={Wrench} color="text-[#5B5CFF]" subtext={`${osUrgent.length} urgente/alta`} />
                            <KpiCard label="Docs Vencidos" value={totalDocsExpired} icon={ShieldAlert} color={totalDocsExpired > 0 ? 'text-red-400' : 'text-slate-500'} subtext={`+ ${totalDocsExpiring} vencendo em 30d`} />
                            <KpiCard label="Estoque Baixo" value={lowStockParts.length} icon={Package} color={lowStockParts.length > 0 ? 'text-amber-400' : 'text-emerald-400'} subtext={`${parts.length} itens cadastrados`} />
                            <KpiCard label="Veículos Parados" value={vehiclesInMaint + vehiclesInactive} icon={Truck} color={vehiclesInMaint > 0 ? 'text-red-400' : 'text-emerald-400'} subtext={`${vehiclesInMaint} em manutenção`} />
                        </div>
                    )}

                    {/* ====== ROW 2: OS KPIs ====== */}
                    <div>
                        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-[#5B5CFF]" /> Ordens de Serviço — Período
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                            <KpiCard label="Total OS" value={osInPeriod.length} icon={Wrench} color="text-[#5B5CFF]" />
                            <KpiCard label="Concluídas" value={osCompleted.length} icon={CheckCircle} color="text-emerald-400" />
                            <KpiCard label="Canceladas" value={osCancelled.length} icon={XCircle} color="text-red-400" />
                            <KpiCard label="Tempo Médio" value={`${avgTimeHours.toFixed(1)}h`} icon={Clock} color="text-amber-400" />
                            <KpiCard label="Veículos" value={osVehicle.length} icon={Truck} color="text-[#5B5CFF]" />
                            <KpiCard label="Máquinas" value={osMachine.length} icon={Cog} color="text-[#00E5FF]" />
                            <KpiCard label="Predial" value={osFacility.length} icon={Building2} color="text-amber-400" />
                            <KpiCard label="Custo Total" value={`R$ ${totalMaintenanceCost.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} icon={DollarSign} color="text-emerald-400" />
                        </div>
                    </div>

                    {/* ====== ROW 3: Gráficos OS ====== */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* OS volume chart */}
                        <div className="lg:col-span-2 glass-card rounded-xl p-5">
                            <h3 className="text-sm font-semibold text-white mb-3">Volume de OS por Dia</h3>
                            <div className="h-56">
                                {osPerDay.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={osPerDay}>
                                            <defs><linearGradient id="gOS" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00E5FF" /><stop offset="95%" stopColor="#5B5CFF" stopOpacity={0.8} /></linearGradient></defs>
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tickStyle} />
                                            <YAxis axisLine={false} tickLine={false} tick={tickStyle} allowDecimals={false} />
                                            <Tooltip cursor={{ fill: 'rgba(91,92,255,0.05)' }} contentStyle={tooltipStyle} itemStyle={{ color: '#00E5FF', fontWeight: 'bold' }} />
                                            <Bar dataKey="OS" fill="url(#gOS)" radius={[4, 4, 0, 0]} barSize={28} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : <p className="text-center text-slate-500 pt-16">Sem dados no período</p>}
                            </div>
                        </div>

                        {/* OS by status pie */}
                        <div className="glass-card rounded-xl p-5">
                            <h3 className="text-sm font-semibold text-white mb-3">OS por Status</h3>
                            <div className="h-56 flex items-center justify-center">
                                {osByStatus.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={osByStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false} stroke="none">
                                                {osByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : <p className="text-slate-500">Sem dados</p>}
                            </div>
                        </div>
                    </div>

                    {/* ====== ROW 4: Abastecimento + Estoque ====== */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Fuel */}
                        <div>
                            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Fuel className="w-4 h-4 text-emerald-400" /> Abastecimentos — Período
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                <KpiCard label="Abastecimentos" value={fuelings.length} icon={Fuel} color="text-[#5B5CFF]" />
                                <KpiCard label="Custo Total" value={`R$ ${fuelTotalCost.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} icon={DollarSign} color="text-emerald-400" />
                                <KpiCard label="Consumo Médio" value={`${fuelAvgConsumption.toFixed(1)} km/L`} icon={Gauge} color="text-amber-400" />
                                <KpiCard label="Custo/KM" value={`R$ ${fuelAvgCostKm.toFixed(2)}`} icon={TrendingUp} color="text-purple-400" />
                            </div>
                            <div className="glass-card rounded-xl p-5">
                                <h3 className="text-sm font-semibold text-white mb-3">Custo de Abastecimento por Dia</h3>
                                <div className="h-48">
                                    {fuelPerDay.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={fuelPerDay}>
                                                <defs><linearGradient id="gFuel" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" /><stop offset="95%" stopColor="#065f46" stopOpacity={0.8} /></linearGradient></defs>
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tickStyle} />
                                                <YAxis axisLine={false} tickLine={false} tick={tickStyle} />
                                                <Tooltip cursor={{ fill: 'rgba(16,185,129,0.05)' }} contentStyle={tooltipStyle} itemStyle={{ color: '#10b981', fontWeight: 'bold' }} formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                                                <Bar dataKey="Custo" fill="url(#gFuel)" radius={[4, 4, 0, 0]} barSize={24} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : <p className="text-center text-slate-500 pt-12">Sem dados</p>}
                                </div>
                            </div>
                        </div>

                        {/* Inventory + fleet */}
                        <div>
                            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Package className="w-4 h-4 text-[#00E5FF]" /> Estoque & Frota
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                <KpiCard label="Itens Cadastrados" value={parts.length} icon={Package} color="text-[#00E5FF]" />
                                <KpiCard label="Valor em Estoque" value={`R$ ${totalStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} icon={DollarSign} color="text-emerald-400" />
                                <KpiCard label="Reservados" value={totalReserved > 0 ? totalReserved.toFixed(0) : '0'} icon={ShieldAlert} color="text-amber-400" />
                                <KpiCard label="Estoque Baixo" value={lowStockParts.length} icon={AlertTriangle} color={lowStockParts.length > 0 ? 'text-red-400' : 'text-emerald-400'} />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <KpiCard label="Veículos Ativos" value={vehiclesActive} icon={Truck} color="text-emerald-400" />
                                <KpiCard label="Em Manutenção" value={vehiclesInMaint} icon={Wrench} color={vehiclesInMaint > 0 ? 'text-amber-400' : 'text-emerald-400'} />
                                <KpiCard label="Técnicos Ativos" value={activeTechnicians} icon={Users} color="text-[#5B5CFF]" />
                                <KpiCard label="Motoristas" value={drivers.filter(d => d.active).length} icon={Users} color="text-[#00E5FF]" />
                            </div>
                        </div>
                    </div>

                    {/* ====== ROW 5: Lava-Jato + Documentos ====== */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Car Wash */}
                        <div>
                            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Droplets className="w-4 h-4 text-sky-400" /> Lava-Jato — Período
                            </h2>
                            <div className="grid grid-cols-3 gap-3">
                                <KpiCard label="Concluídas" value={cwCompleted} icon={CheckCircle} color="text-emerald-400" />
                                <KpiCard label="Pendentes" value={cwPending} icon={Clock} color="text-amber-400" />
                                <KpiCard label="Canceladas" value={cwCancelled} icon={XCircle} color="text-red-400" />
                            </div>
                        </div>

                        {/* Documents */}
                        <div>
                            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <FileWarning className="w-4 h-4 text-red-400" /> Documentos & CNH
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <KpiCard label="Docs Vencidos" value={totalDocsExpired} icon={XCircle} color={totalDocsExpired > 0 ? 'text-red-400' : 'text-emerald-400'} />
                                <KpiCard label="Vencendo 30d" value={totalDocsExpiring} icon={AlertTriangle} color={totalDocsExpiring > 0 ? 'text-amber-400' : 'text-emerald-400'} />
                                <KpiCard label="CNH Vencida" value={driversCNHExpired.length} icon={ShieldAlert} color={driversCNHExpired.length > 0 ? 'text-red-400' : 'text-emerald-400'} />
                                <KpiCard label="CNH Vencendo" value={driversCNHExpiring.length} icon={Calendar} color={driversCNHExpiring.length > 0 ? 'text-amber-400' : 'text-emerald-400'} />
                            </div>
                        </div>
                    </div>

                    {/* ====== ROW 6: Alerts Lists ====== */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Low stock list */}
                        <Card className="glass-card bg-[#0f0f14]/50 border-white/5">
                            <CardHeader className="pb-2 border-b border-white/5">
                                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-400" /> Estoque Abaixo do Mínimo
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-3 max-h-64 overflow-y-auto space-y-2">
                                {lowStockParts.length === 0 ? (
                                    <p className="text-slate-500 text-sm text-center py-4">✅ Tudo em ordem</p>
                                ) : lowStockParts.map(p => (
                                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                                        <span className="text-sm text-white truncate">{p.description}</span>
                                        <span className="text-xs font-mono text-red-400 shrink-0 ml-2">{Number(p.current_stock).toFixed(0)} / {Number(p.min_stock).toFixed(0)}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Expiring docs */}
                        <Card className="glass-card bg-[#0f0f14]/50 border-white/5">
                            <CardHeader className="pb-2 border-b border-white/5">
                                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                                    <FileWarning className="w-4 h-4 text-amber-400" /> Docs Vencendo (30 dias)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-3 max-h-64 overflow-y-auto space-y-2">
                                {[...expiringVehicleDocs, ...expiredVehicleDocs.slice(0, 5)].length === 0 ? (
                                    <p className="text-slate-500 text-sm text-center py-4">✅ Tudo em dia</p>
                                ) : [...expiredVehicleDocs.slice(0, 5), ...expiringVehicleDocs].map(d => {
                                    const isExpired = new Date(d.expiration_date) < new Date(today.toDateString());
                                    return (
                                        <div key={d.id} className={`flex items-center justify-between p-2 rounded-lg border ${isExpired ? 'bg-red-500/5 border-red-500/10' : 'bg-amber-500/5 border-amber-500/10'}`}>
                                            <div className="truncate">
                                                <span className="text-sm text-white">{d.type}</span>
                                                <span className="text-[10px] text-slate-400 ml-2">{d.vehicles?.plate}</span>
                                            </div>
                                            <span className={`text-xs font-mono shrink-0 ml-2 ${isExpired ? 'text-red-400' : 'text-amber-400'}`}>
                                                {new Date(d.expiration_date).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        {/* Urgent OS */}
                        <Card className="glass-card bg-[#0f0f14]/50 border-white/5">
                            <CardHeader className="pb-2 border-b border-white/5">
                                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-[#5B5CFF]" /> OS Urgentes/Alta Prioridade
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-3 max-h-64 overflow-y-auto space-y-2">
                                {osUrgent.length === 0 ? (
                                    <p className="text-slate-500 text-sm text-center py-4">✅ Sem OS urgentes</p>
                                ) : osUrgent.slice(0, 8).map(o => (
                                    <div key={o.id} className="flex items-center justify-between p-2 rounded-lg bg-[#5B5CFF]/5 border border-[#5B5CFF]/10">
                                        <div className="truncate">
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium mr-2 ${o.priority === 'urgente' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>{o.priority}</span>
                                            <span className="text-sm text-white">{o.type}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 shrink-0 ml-2">{o.status?.replace('_', ' ')}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ====== ROW 7: OS by type & priority pies ====== */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="glass-card rounded-xl p-5">
                            <h3 className="text-sm font-semibold text-white mb-3">OS por Tipo</h3>
                            <div className="h-48 flex items-center justify-center">
                                {osByType.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={osByType} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false} stroke="none">
                                                {osByType.map((d, i) => <Cell key={i} fill={d.color} />)}
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : <p className="text-slate-500 text-sm">Sem dados</p>}
                            </div>
                        </div>
                        <div className="glass-card rounded-xl p-5">
                            <h3 className="text-sm font-semibold text-white mb-3">OS por Prioridade</h3>
                            <div className="h-48 flex items-center justify-center">
                                {osByPriority.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={osByPriority} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false} stroke="none">
                                                {osByPriority.map((_, i) => <Cell key={i} fill={['#10b981', '#f59e0b', '#ef4444', '#dc2626'][i]} />)}
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : <p className="text-slate-500 text-sm">Sem dados</p>}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
