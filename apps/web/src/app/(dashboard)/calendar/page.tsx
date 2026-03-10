"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Calendar, ChevronLeft, ChevronRight, Wrench, Droplets, FileWarning,
    ShieldAlert, Clock, X, GripVertical, Plus, Truck, Cog, Building2
} from 'lucide-react';

type CalendarEvent = {
    id: string;
    title: string;
    type: string; // 'os_programada' | 'preventiva' | 'vencimento' | 'lavagem'
    reference_id?: string;
    start_date: string;
    end_date: string;
    responsible_user_id?: string;
    color: string;
    icon: string;
    source: 'manual' | 'auto';
    meta?: any;
};

type ViewMode = 'month' | 'week' | 'day';

const EVENT_COLORS: Record<string, string> = {
    os_programada: '#5B5CFF',
    preventiva: '#00E5FF',
    vencimento: '#ef4444',
    lavagem: '#3b82f6',
    os_aberta: '#f59e0b',
    os_urgente: '#ef4444',
};

const TYPE_LABELS: Record<string, string> = {
    os_programada: 'OS Programada',
    preventiva: 'Preventiva',
    vencimento: 'Vencimento',
    lavagem: 'Lavagem',
    os_aberta: 'OS Aberta',
    os_urgente: 'OS Urgente',
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function getMonthGrid(year: number, month: number) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = getDaysInMonth(year, month);
    const prevDays = getDaysInMonth(year, month - 1);
    const grid: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) grid.push({ day: prevDays - i, month: month - 1, year: month === 0 ? year - 1 : year, isCurrentMonth: false });
    for (let d = 1; d <= daysInMonth; d++) grid.push({ day: d, month, year, isCurrentMonth: true });
    const remaining = 42 - grid.length;
    for (let d = 1; d <= remaining; d++) grid.push({ day: d, month: month + 1, year: month === 11 ? year + 1 : year, isCurrentMonth: false });
    return grid;
}

function getWeekDays(date: Date) {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return d;
    });
}

function isSameDay(d1: Date, d2: Date) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

export default function CalendarPage() {
    const { session } = useAuth();
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [showNewModal, setShowNewModal] = useState(false);
    const [newEvent, setNewEvent] = useState({ title: '', type: 'os_programada', start_date: '', end_date: '', start_time: '08:00', end_time: '17:00' });
    const [dragEvent, setDragEvent] = useState<CalendarEvent | null>(null);
    const [filterType, setFilterType] = useState<string>('all');
    const [dragOverCell, setDragOverCell] = useState<string | null>(null);
    const isDraggingRef = useRef(false);

    const loadEvents = useCallback(async () => {
        setLoading(true);
        try {
            const rangeStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
            const rangeEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);
            const startISO = rangeStart.toISOString();
            const endISO = rangeEnd.toISOString();

            const autoEvents: CalendarEvent[] = [];

            // 1. Work Orders (OS)
            const { data: woData } = await supabase
                .from('work_orders')
                .select('id, type, description, status, priority, opening_date, start_date, completion_date, vehicles(plate), assets_machines(name), assets_facilities(name), maintenance_technicians(name)')
                .gte('opening_date', startISO).lte('opening_date', endISO);

            if (woData) {
                woData.forEach((wo: any) => {
                    const isUrgent = wo.priority === 'urgente' || wo.priority === 'alta';
                    const asset = wo.vehicles?.plate || wo.assets_machines?.name || wo.assets_facilities?.name || '';
                    autoEvents.push({
                        id: `wo-${wo.id}`,
                        title: `[${wo.type === 'vehicle' ? 'Veíc' : wo.type === 'machine' ? 'Máq' : 'Pred'}] ${wo.description?.substring(0, 40)}`,
                        type: isUrgent ? 'os_urgente' : 'os_aberta',
                        reference_id: wo.id,
                        start_date: wo.opening_date,
                        end_date: wo.completion_date || wo.start_date || wo.opening_date,
                        color: isUrgent ? EVENT_COLORS.os_urgente : EVENT_COLORS.os_programada,
                        icon: 'wrench',
                        source: 'auto',
                        meta: { status: wo.status, priority: wo.priority, asset, technician: wo.maintenance_technicians?.name }
                    });
                });
            }

            // 2. Car wash schedules
            const { data: cwData } = await supabase
                .from('car_wash_schedules')
                .select('id, vehicle_id, wash_type, scheduled_date, status, completion_date, vehicles(plate)')
                .gte('scheduled_date', startISO).lte('scheduled_date', endISO);

            if (cwData) {
                cwData.forEach((cw: any) => {
                    autoEvents.push({
                        id: `cw-${cw.id}`,
                        title: `Lavagem ${cw.wash_type} - ${cw.vehicles?.plate || ''}`,
                        type: 'lavagem',
                        reference_id: cw.id,
                        start_date: cw.scheduled_date,
                        end_date: cw.completion_date || cw.scheduled_date,
                        color: EVENT_COLORS.lavagem,
                        icon: 'droplets',
                        source: 'auto',
                        meta: { status: cw.status, wash_type: cw.wash_type }
                    });
                });
            }

            // 3. Vehicle documents expiring
            const { data: vdData } = await supabase
                .from('vehicle_documents')
                .select('id, type, expiration_date, vehicles(plate)')
                .gte('expiration_date', startISO).lte('expiration_date', endISO);

            if (vdData) {
                vdData.forEach((d: any) => {
                    autoEvents.push({
                        id: `vd-${d.id}`,
                        title: `Venc. ${d.type} - ${d.vehicles?.plate || ''}`,
                        type: 'vencimento',
                        reference_id: d.id,
                        start_date: d.expiration_date,
                        end_date: d.expiration_date,
                        color: EVENT_COLORS.vencimento,
                        icon: 'alert',
                        source: 'auto',
                        meta: { doc_type: d.type }
                    });
                });
            }

            // 4. Driver documents / CNH expiring
            const { data: ddData } = await supabase
                .from('driver_documents')
                .select('id, type, expiration_date, drivers(name)')
                .gte('expiration_date', startISO).lte('expiration_date', endISO);

            if (ddData) {
                ddData.forEach((d: any) => {
                    autoEvents.push({
                        id: `dd-${d.id}`,
                        title: `Venc. ${d.type} - ${d.drivers?.name || ''}`,
                        type: 'vencimento',
                        reference_id: d.id,
                        start_date: d.expiration_date,
                        end_date: d.expiration_date,
                        color: EVENT_COLORS.vencimento,
                        icon: 'alert',
                        source: 'auto',
                        meta: { doc_type: d.type }
                    });
                });
            }

            // 5. Tachograph / Insurance expirations
            const { data: tData } = await supabase
                .from('tachograph_checks')
                .select('id, expiration_date, vehicles(plate)')
                .gte('expiration_date', startISO).lte('expiration_date', endISO);

            if (tData) {
                tData.forEach((t: any) => {
                    autoEvents.push({
                        id: `tac-${t.id}`,
                        title: `Venc. Tacógrafo - ${t.vehicles?.plate || ''}`,
                        type: 'vencimento',
                        reference_id: t.id,
                        start_date: t.expiration_date,
                        end_date: t.expiration_date,
                        color: EVENT_COLORS.vencimento,
                        icon: 'alert',
                        source: 'auto',
                    });
                });
            }

            const { data: insData } = await supabase
                .from('insurances')
                .select('id, insurer_name, end_date, vehicles(plate)')
                .gte('end_date', startISO).lte('end_date', endISO);

            if (insData) {
                insData.forEach((i: any) => {
                    autoEvents.push({
                        id: `ins-${i.id}`,
                        title: `Venc. Seguro ${i.insurer_name} - ${i.vehicles?.plate || ''}`,
                        type: 'vencimento',
                        reference_id: i.id,
                        start_date: i.end_date,
                        end_date: i.end_date,
                        color: EVENT_COLORS.vencimento,
                        icon: 'alert',
                        source: 'auto',
                    });
                });
            }

            // 6. Manual calendar events
            const { data: manualData } = await supabase
                .from('calendar_events')
                .select('*')
                .gte('start_date', startISO).lte('start_date', endISO);

            if (manualData) {
                manualData.forEach((e: any) => {
                    autoEvents.push({
                        id: e.id,
                        title: e.title,
                        type: e.type || 'os_programada',
                        reference_id: e.reference_id,
                        start_date: e.start_date,
                        end_date: e.end_date,
                        responsible_user_id: e.responsible_user_id,
                        color: EVENT_COLORS[e.type] || EVENT_COLORS.os_programada,
                        icon: 'calendar',
                        source: 'manual',
                    });
                });
            }

            setEvents(autoEvents);
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [currentDate]);

    useEffect(() => { loadEvents(); }, [loadEvents]);

    const filteredEvents = filterType === 'all' ? events : events.filter(e => e.type === filterType);

    // Navigation
    const navigate = (dir: number) => {
        const d = new Date(currentDate);
        if (viewMode === 'month') d.setMonth(d.getMonth() + dir);
        else if (viewMode === 'week') d.setDate(d.getDate() + dir * 7);
        else d.setDate(d.getDate() + dir);
        setCurrentDate(d);
    };

    const goToday = () => setCurrentDate(new Date());

    // Drag and drop
    const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
        setDragEvent(event);
        isDraggingRef.current = true;
        e.dataTransfer.setData('text/plain', event.id);
        e.dataTransfer.effectAllowed = 'move';
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '0.4';
        }
    };

    const handleDragEnd = (e: React.DragEvent) => {
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '1';
        }
        setDragOverCell(null);
        setTimeout(() => { isDraggingRef.current = false; }, 100);
    };

    const handleDragOver = (e: React.DragEvent, cellKey: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverCell(cellKey);
    };

    const handleDragLeave = () => {
        setDragOverCell(null);
    };

    const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
        e.preventDefault();
        setDragOverCell(null);
        if (!dragEvent) return;

        const diff = new Date(dragEvent.end_date).getTime() - new Date(dragEvent.start_date).getTime();
        const newStart = new Date(targetDate);
        newStart.setHours(new Date(dragEvent.start_date).getHours(), new Date(dragEvent.start_date).getMinutes());
        const newEnd = new Date(newStart.getTime() + diff);

        let success = false;

        if (dragEvent.source === 'manual') {
            const { error } = await supabase.from('calendar_events').update({
                start_date: newStart.toISOString(), end_date: newEnd.toISOString()
            }).eq('id', dragEvent.id);
            success = !error;
        } else if (dragEvent.id.startsWith('wo-')) {
            const woId = dragEvent.id.replace('wo-', '');
            const { error } = await supabase.from('work_orders').update({
                opening_date: newStart.toISOString()
            }).eq('id', woId);
            success = !error;
        } else if (dragEvent.id.startsWith('cw-')) {
            const cwId = dragEvent.id.replace('cw-', '');
            const { error } = await supabase.from('car_wash_schedules').update({
                scheduled_date: newStart.toISOString()
            }).eq('id', cwId);
            success = !error;
        }

        if (success) {
            setEvents(prev => prev.map(ev => ev.id === dragEvent.id
                ? { ...ev, start_date: newStart.toISOString(), end_date: newEnd.toISOString() }
                : ev
            ));
        }
        setDragEvent(null);
    };

    // Create event
    const handleCreateEvent = async () => {
        if (!newEvent.title || !newEvent.start_date) return;
        const tenantRes = await supabase.from('tenants').select('id').limit(1).single();
        const startDt = `${newEvent.start_date}T${newEvent.start_time}:00`;
        const endDt = newEvent.end_date ? `${newEvent.end_date}T${newEvent.end_time}:00` : startDt;
        const { error } = await supabase.from('calendar_events').insert({
            tenant_id: tenantRes.data?.id,
            title: newEvent.title,
            type: newEvent.type,
            start_date: startDt,
            end_date: endDt,
        });
        if (!error) {
            setShowNewModal(false);
            setNewEvent({ title: '', type: 'os_programada', start_date: '', end_date: '', start_time: '08:00', end_time: '17:00' });
            loadEvents();
        }
    };

    // Get events for a specific day
    const getEventsForDay = (date: Date) => {
        return filteredEvents.filter(e => {
            const start = new Date(e.start_date);
            return isSameDay(start, date);
        });
    };

    const today = new Date();
    const monthGrid = getMonthGrid(currentDate.getFullYear(), currentDate.getMonth());
    const weekDays = getWeekDays(currentDate);
    const hours = Array.from({ length: 15 }, (_, i) => i + 6); // 6:00 to 20:00

    const canDrag = (event: CalendarEvent) => event.source === 'manual' || event.id.startsWith('wo-') || event.id.startsWith('cw-');

    const EventBadge = ({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) => (
        <div
            draggable={canDrag(event)}
            onDragStart={(e) => handleDragStart(e, event)}
            onDragEnd={handleDragEnd}
            onClick={(e) => { e.stopPropagation(); if (!isDraggingRef.current) setSelectedEvent(event); }}
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium truncate cursor-pointer transition-all hover:brightness-125 hover:scale-[1.02] ${canDrag(event) ? 'cursor-grab active:cursor-grabbing' : ''} select-none`}
            style={{ backgroundColor: `${event.color}25`, color: event.color, borderLeft: `3px solid ${event.color}` }}
            title={`${event.title}${canDrag(event) ? ' (arraste para reagendar)' : ''}`}
        >
            {canDrag(event) && <GripVertical className="inline w-2.5 h-2.5 mr-0.5 opacity-50" />}
            {compact ? event.title.substring(0, 12) : event.title.substring(0, 28)}
            {event.title.length > (compact ? 12 : 28) ? '…' : ''}
        </div>
    );

    const headerLabel = viewMode === 'month'
        ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
        : viewMode === 'week'
            ? `${weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`
            : currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Calendar className="w-7 h-7 text-[#00E5FF]" /> Agenda
                    </h1>
                    <p className="text-slate-400 mt-0.5 text-sm">Calendário com eventos de todos os módulos.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => setShowNewModal(true)} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] text-white border-0 text-xs">
                        <Plus className="w-3 h-3 mr-1" /> Novo Evento
                    </Button>
                </div>
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => navigate(-1)} className="border border-white/10 text-slate-400 hover:text-white h-8 w-8 p-0">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={goToday} className="border border-white/10 text-slate-400 hover:text-white text-xs px-3">Hoje</Button>
                    <Button size="sm" variant="ghost" onClick={() => navigate(1)} className="border border-white/10 text-slate-400 hover:text-white h-8 w-8 p-0">
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                    <h2 className="text-lg font-semibold text-white ml-2 capitalize">{headerLabel}</h2>
                </div>
                <div className="flex items-center gap-2">
                    {/* Filter */}
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}
                        className="px-2 py-1 bg-black/30 border border-white/10 rounded text-white text-xs focus:outline-none focus:ring-[#00E5FF]">
                        <option value="all" className="bg-[#0f0f14]">Todos</option>
                        <option value="os_programada" className="bg-[#0f0f14]">OS Programada</option>
                        <option value="os_aberta" className="bg-[#0f0f14]">OS Aberta</option>
                        <option value="os_urgente" className="bg-[#0f0f14]">OS Urgente</option>
                        <option value="lavagem" className="bg-[#0f0f14]">Lavagem</option>
                        <option value="vencimento" className="bg-[#0f0f14]">Vencimento</option>
                        <option value="preventiva" className="bg-[#0f0f14]">Preventiva</option>
                    </select>
                    {/* View mode */}
                    {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
                        <Button key={mode} size="sm"
                            variant={viewMode === mode ? 'primary' : 'ghost'}
                            onClick={() => setViewMode(mode)}
                            className={viewMode === mode
                                ? 'bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] text-white border-0 text-xs'
                                : 'border border-white/10 text-slate-400 hover:text-white text-xs'}>
                            {mode === 'month' ? 'Mês' : mode === 'week' ? 'Semana' : 'Dia'}
                        </Button>
                    ))}
                </div>
            </div>

            {loading && <p className="text-slate-400 text-center py-8 animate-pulse">Carregando agenda...</p>}

            {!loading && (
                <>
                    {/* ====== MONTH VIEW ====== */}
                    {viewMode === 'month' && (
                        <div className="glass-card rounded-xl overflow-hidden border border-white/5">
                            <div className="grid grid-cols-7 border-b border-white/5">
                                {WEEKDAYS.map(d => (
                                    <div key={d} className="text-center py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7">
                                {monthGrid.map((cell, i) => {
                                    const cellDate = new Date(cell.year, cell.month, cell.day);
                                    const dayEvents = getEventsForDay(cellDate);
                                    const isToday = isSameDay(cellDate, today);
                                    return (
                                        <div
                                            key={i}
                                            className={`min-h-[100px] p-1 border-b border-r border-white/5 relative transition-all ${cell.isCurrentMonth ? 'bg-transparent' : 'bg-black/20'} ${isToday ? 'ring-1 ring-[#00E5FF]/40 bg-[#00E5FF]/5' : ''} ${dragOverCell === `m-${i}` ? 'bg-[#5B5CFF]/10 ring-2 ring-[#5B5CFF]/40 scale-[1.01]' : 'hover:bg-white/[0.02]'}`}
                                            onDragOver={(e) => handleDragOver(e, `m-${i}`)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, cellDate)}
                                            onClick={() => { if (!isDraggingRef.current) { setCurrentDate(cellDate); setViewMode('day'); } }}
                                        >
                                            <span className={`text-xs font-mono ${isToday ? 'bg-[#00E5FF] text-black rounded-full w-6 h-6 flex items-center justify-center font-bold' : cell.isCurrentMonth ? 'text-slate-300' : 'text-slate-600'}`}>
                                                {cell.day}
                                            </span>
                                            <div className="space-y-0.5 mt-1">
                                                {dayEvents.slice(0, 3).map(ev => (
                                                    <EventBadge key={ev.id} event={ev} compact />
                                                ))}
                                                {dayEvents.length > 3 && (
                                                    <span className="text-[9px] text-slate-500 pl-1">+{dayEvents.length - 3} mais</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ====== WEEK VIEW ====== */}
                    {viewMode === 'week' && (
                        <div className="glass-card rounded-xl overflow-hidden border border-white/5">
                            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-white/5">
                                <div className="py-2 text-center text-xs text-slate-500">Hora</div>
                                {weekDays.map((d, i) => (
                                    <div key={i} className={`py-2 text-center border-l border-white/5 ${isSameDay(d, today) ? 'bg-[#00E5FF]/5' : ''}`}>
                                        <span className="text-xs text-slate-400">{WEEKDAYS[i]}</span>
                                        <span className={`block text-sm font-mono ${isSameDay(d, today) ? 'text-[#00E5FF] font-bold' : 'text-white'}`}>{d.getDate()}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="max-h-[600px] overflow-y-auto">
                                {hours.map(h => (
                                    <div key={h} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-white/5 min-h-[50px]">
                                        <div className="text-[10px] text-slate-500 font-mono text-right pr-2 pt-1">{String(h).padStart(2, '0')}:00</div>
                                        {weekDays.map((d, di) => {
                                            const dayEvents = getEventsForDay(d).filter(ev => {
                                                const evHour = new Date(ev.start_date).getHours();
                                                return evHour >= h && evHour < h + 1;
                                            });
                                            return (
                                                <div
                                                    key={di}
                                                    className={`border-l border-white/5 p-0.5 transition-all ${isSameDay(d, today) ? 'bg-[#00E5FF]/[0.02]' : ''} ${dragOverCell === `w-${h}-${di}` ? 'bg-[#5B5CFF]/10 ring-1 ring-[#5B5CFF]/30' : 'hover:bg-white/[0.02]'}`}
                                                    onDragOver={(e) => handleDragOver(e, `w-${h}-${di}`)}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => { const target = new Date(d); target.setHours(h); handleDrop(e, target); }}
                                                >
                                                    {dayEvents.map(ev => <EventBadge key={ev.id} event={ev} compact />)}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ====== DAY VIEW ====== */}
                    {viewMode === 'day' && (
                        <div className="glass-card rounded-xl overflow-hidden border border-white/5">
                            <div className="max-h-[700px] overflow-y-auto">
                                {hours.map(h => {
                                    const dayEvents = getEventsForDay(currentDate).filter(ev => {
                                        const evHour = new Date(ev.start_date).getHours();
                                        return evHour >= h && evHour < h + 1;
                                    });
                                    return (
                                        <div key={h} className={`grid grid-cols-[80px_1fr] border-b border-white/5 min-h-[60px] transition-all ${dragOverCell === `d-${h}` ? 'bg-[#5B5CFF]/10 ring-1 ring-[#5B5CFF]/30' : ''}`}
                                            onDragOver={(e) => handleDragOver(e, `d-${h}`)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => { const target = new Date(currentDate); target.setHours(h); handleDrop(e, target); }}>
                                            <div className="text-sm text-slate-500 font-mono text-right pr-3 pt-2 border-r border-white/5">{String(h).padStart(2, '0')}:00</div>
                                            <div className="p-1 space-y-1 hover:bg-white/[0.02]">
                                                {dayEvents.map(ev => <EventBadge key={ev.id} event={ev} />)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <span className="text-xs text-slate-500">Legenda:</span>
                        {Object.entries(TYPE_LABELS).map(([key, label]) => (
                            <div key={key} className="flex items-center gap-1.5 cursor-pointer hover:opacity-80" onClick={() => setFilterType(filterType === key ? 'all' : key)}>
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: EVENT_COLORS[key] }} />
                                <span className={`text-[10px] ${filterType === key ? 'text-white font-bold' : 'text-slate-400'}`}>{label}</span>
                            </div>
                        ))}
                        <span className="text-[10px] text-slate-600 ml-2">• Arraste eventos (OS / Lavagens / Manuais) para reagendar</span>
                    </div>
                </>
            )}

            {/* ====== EVENT DETAIL MODAL ====== */}
            {selectedEvent && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedEvent(null)}>
                    <div className="glass-card rounded-xl w-full max-w-md p-6 border border-white/10" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedEvent.color }} />
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${selectedEvent.color}20`, color: selectedEvent.color }}>
                                    {TYPE_LABELS[selectedEvent.type] || selectedEvent.type}
                                </span>
                            </div>
                            <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-3">{selectedEvent.title}</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Início:</span>
                                <span className="text-white font-mono">{new Date(selectedEvent.start_date).toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Fim:</span>
                                <span className="text-white font-mono">{new Date(selectedEvent.end_date).toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Origem:</span>
                                <span className={`${selectedEvent.source === 'manual' ? 'text-[#00E5FF]' : 'text-amber-400'}`}>{selectedEvent.source === 'manual' ? 'Manual' : 'Automático'}</span>
                            </div>
                            {selectedEvent.meta?.status && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Status:</span>
                                    <span className="text-white capitalize">{selectedEvent.meta.status?.replace('_', ' ')}</span>
                                </div>
                            )}
                            {selectedEvent.meta?.priority && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Prioridade:</span>
                                    <span className={`capitalize ${selectedEvent.meta.priority === 'urgente' ? 'text-red-400' : selectedEvent.meta.priority === 'alta' ? 'text-amber-400' : 'text-white'}`}>{selectedEvent.meta.priority}</span>
                                </div>
                            )}
                            {selectedEvent.meta?.asset && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Ativo:</span>
                                    <span className="text-white">{selectedEvent.meta.asset}</span>
                                </div>
                            )}
                            {selectedEvent.meta?.technician && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Técnico:</span>
                                    <span className="text-white">{selectedEvent.meta.technician}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ====== NEW EVENT MODAL ====== */}
            {showNewModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNewModal(false)}>
                    <div className="glass-card rounded-xl w-full max-w-md p-6 border border-white/10" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">Novo Evento</h3>
                            <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Título *</label>
                                <input value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]" placeholder="Descrição do evento" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Tipo</label>
                                <select value={newEvent.type} onChange={e => setNewEvent({ ...newEvent, type: e.target.value })}
                                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]">
                                    <option value="os_programada" className="bg-[#0f0f14]">OS Programada</option>
                                    <option value="preventiva" className="bg-[#0f0f14]">Preventiva</option>
                                    <option value="vencimento" className="bg-[#0f0f14]">Vencimento</option>
                                    <option value="lavagem" className="bg-[#0f0f14]">Lavagem</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Data Início *</label>
                                    <input type="date" value={newEvent.start_date} onChange={e => setNewEvent({ ...newEvent, start_date: e.target.value })}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Hora Início</label>
                                    <input type="time" value={newEvent.start_time} onChange={e => setNewEvent({ ...newEvent, start_time: e.target.value })}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Data Fim</label>
                                    <input type="date" value={newEvent.end_date} onChange={e => setNewEvent({ ...newEvent, end_date: e.target.value })}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Hora Fim</label>
                                    <input type="time" value={newEvent.end_time} onChange={e => setNewEvent({ ...newEvent, end_time: e.target.value })}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]" />
                                </div>
                            </div>
                            <Button onClick={handleCreateEvent} className="w-full bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] text-white border-0 mt-2">
                                Criar Evento
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
