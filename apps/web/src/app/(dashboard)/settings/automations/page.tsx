"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Settings, Users, Shield, ScrollText, Bell, Zap, Server, X, Plus, Play, Pause, Trash2, Loader2, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
    { name: 'Usuários', href: '/settings', icon: Users },
    { name: 'Roles e Permissões', href: '/settings/roles', icon: Shield },
    { name: 'Auditoria', href: '/settings/audit', icon: ScrollText },
    { name: 'Notificações', href: '/settings/notifications', icon: Bell },
    { name: 'Automações', href: '/settings/automations', icon: Zap },
    { name: 'Sistema', href: '/settings/system', icon: Server },
];

const EVENTS = [
    { value: 'cnh_expiring', label: 'CNH vencendo' },
    { value: 'document_expiring', label: 'Documento de veículo vencendo' },
    { value: 'exam_expiring', label: 'Exame periódico vencendo' },
    { value: 'insurance_expiring', label: 'Seguro vencendo' },
    { value: 'low_stock', label: 'Estoque abaixo do mínimo' },
    { value: 'os_sla_exceeded', label: 'OS atrasada (SLA excedido)' },
    { value: 'preventive_due', label: 'Manutenção preventiva próxima' },
    { value: 'wash_overdue', label: 'Lavagem atrasada' },
    { value: 'tachograph_expiring', label: 'Tacógrafo vencendo' },
];

const ACTIONS = [
    { value: 'notification', label: 'Criar notificação in-app' },
    { value: 'email', label: 'Enviar e-mail' },
    { value: 'create_os', label: 'Abrir OS automaticamente' },
    { value: 'calendar_event', label: 'Criar evento no calendário' },
];

const FREQUENCIES = [
    { value: 'hourly', label: 'A cada hora' },
    { value: 'daily', label: 'Diariamente' },
    { value: 'weekly', label: 'Semanalmente' },
];

const RECIPIENT_TYPES = [
    { value: 'all', label: 'Todos os usuários' },
    { value: 'users', label: 'Usuários específicos' },
    { value: 'roles', label: 'Roles de permissão' },
    { value: 'emails', label: 'Emails específicos' },
];

export default function AutomationsPage() {
    const pathname = usePathname();
    const [rules, setRules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editRule, setEditRule] = useState<any>(null);
    const [running, setRunning] = useState(false);
    const [runningRuleId, setRunningRuleId] = useState<string | null>(null);
    const [runResult, setRunResult] = useState<string | null>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [form, setForm] = useState({
        name: '', event: 'cnh_expiring', conditions: '{"days_before": 30}',
        actions: [{ type: 'notification', title: '', message: '' }],
        frequency: 'daily', active: true,
        recipients: { type: 'all', values: [] as string[] },
    });

    const loadRules = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from('automation_rules').select('*').order('created_at', { ascending: false });
        if (data) setRules(data);
        setLoading(false);
    }, []);

    const loadUsersAndRoles = useCallback(async () => {
        const [usersRes, rolesRes] = await Promise.all([
            supabase.from('user_profiles').select('id, name'),
            supabase.from('roles').select('id, name'),
        ]);
        if (usersRes.data) setUsers(usersRes.data);
        if (rolesRes.data) setRoles(rolesRes.data);
    }, []);

    useEffect(() => { loadRules(); loadUsersAndRoles(); }, [loadRules, loadUsersAndRoles]);

    const runAutomationsNow = async (ruleId?: string) => {
        if (ruleId) { setRunningRuleId(ruleId); } else { setRunning(true); }
        setRunResult(null);
        try {
            const body = ruleId ? { ruleId } : {};
            const res = await fetch('/api/automations/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (res.ok) {
                setRunResult(`✅ ${data.message}`);
                loadRules();
            } else {
                setRunResult(`❌ ${data.error || 'Erro ao executar'}`);
            }
        } catch (err: any) {
            setRunResult(`❌ ${err.message}`);
        } finally {
            setRunning(false);
            setRunningRuleId(null);
        }
    };

    const saveRule = async () => {
        if (!form.name) return;
        const tenantRes = await supabase.from('tenants').select('id').limit(1).single();
        const payload = {
            tenant_id: tenantRes.data?.id,
            name: form.name,
            event: form.event,
            conditions: JSON.parse(form.conditions || '{}'),
            actions: form.actions,
            frequency: form.frequency,
            active: form.active,
            recipients: form.recipients,
        };
        if (editRule) {
            await supabase.from('automation_rules').update(payload).eq('id', editRule.id);
        } else {
            await supabase.from('automation_rules').insert(payload);
        }
        setShowModal(false);
        setEditRule(null);
        loadRules();
    };

    const deleteRule = async (id: string) => {
        if (!confirm('Excluir esta automação?')) return;
        await supabase.from('automation_rules').delete().eq('id', id);
        loadRules();
    };

    const toggleActive = async (id: string, active: boolean) => {
        await supabase.from('automation_rules').update({ active: !active }).eq('id', id);
        loadRules();
    };

    const resetForm = () => ({
        name: '', event: 'cnh_expiring', conditions: '{"days_before": 30}',
        actions: [{ type: 'notification', title: '', message: '' }],
        frequency: 'daily', active: true,
        recipients: { type: 'all', values: [] as string[] },
    });

    const openEdit = (rule: any) => {
        setEditRule(rule);
        setForm({
            name: rule.name,
            event: rule.event,
            conditions: JSON.stringify(rule.conditions || {}, null, 2),
            actions: Array.isArray(rule.actions) ? rule.actions : [{ type: 'notification', title: '', message: '' }],
            frequency: rule.frequency || 'daily',
            active: rule.active,
            recipients: rule.recipients || { type: 'all', values: [] },
        });
        setShowModal(true);
    };

    const addAction = () => setForm(prev => ({ ...prev, actions: [...prev.actions, { type: 'notification', title: '', message: '' }] }));
    const removeAction = (i: number) => setForm(prev => ({ ...prev, actions: prev.actions.filter((_, idx) => idx !== i) }));
    const updateAction = (i: number, field: string, value: string) => {
        setForm(prev => ({ ...prev, actions: prev.actions.map((a, idx) => idx === i ? { ...a, [field]: value } : a) }));
    };

    const toggleRecipientValue = (val: string) => {
        setForm(prev => {
            const values = prev.recipients.values.includes(val)
                ? prev.recipients.values.filter(v => v !== val)
                : [...prev.recipients.values, val];
            return { ...prev, recipients: { ...prev.recipients, values } };
        });
    };

    const [emailInput, setEmailInput] = useState('');
    const addEmail = () => {
        if (emailInput.trim() && emailInput.includes('@')) {
            setForm(prev => ({
                ...prev,
                recipients: { ...prev.recipients, values: [...prev.recipients.values, emailInput.trim()] },
            }));
            setEmailInput('');
        }
    };
    const removeEmail = (email: string) => {
        setForm(prev => ({
            ...prev,
            recipients: { ...prev.recipients, values: prev.recipients.values.filter(v => v !== email) },
        }));
    };

    const getRecipientLabel = (rule: any) => {
        const r = rule.recipients;
        if (!r || r.type === 'all') return 'Todos';
        if (r.type === 'users') return `${r.values?.length || 0} usuário(s)`;
        if (r.type === 'roles') return `${r.values?.length || 0} role(s)`;
        if (r.type === 'emails') return `${r.values?.length || 0} email(s)`;
        return 'Todos';
    };

    return (
        <div className="space-y-4">
            <div><h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2"><Settings className="w-7 h-7 text-[#00E5FF]" /> Configurações</h1></div>
            <div className="flex gap-1 flex-wrap border-b border-white/10 pb-0">
                {TABS.map(tab => (
                    <Link key={tab.href} href={tab.href}
                        className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-all',
                            pathname === tab.href ? 'bg-white/5 text-[#00E5FF] border-b-2 border-[#00E5FF]' : 'text-slate-500 hover:text-slate-300')}>
                        <tab.icon className="w-3.5 h-3.5" />{tab.name}
                    </Link>
                ))}
            </div>

            <div className="flex justify-between items-center flex-wrap gap-2">
                <p className="text-sm text-slate-400">Regras automáticas: evento + condição + ação</p>
                <div className="flex gap-2">
                    <Button size="sm" onClick={() => runAutomationsNow()} disabled={running}
                        className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs">
                        {running ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Executando...</> : <><PlayCircle className="w-3.5 h-3.5 mr-1" /> Executar Todas</>}
                    </Button>
                    <Button size="sm" onClick={() => { setEditRule(null); setForm(resetForm()); setShowModal(true); }}
                        className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] text-white border-0 text-xs">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Nova Automação
                    </Button>
                </div>
            </div>

            {runResult && (
                <div className={cn('p-3 rounded-lg text-xs border',
                    runResult.startsWith('✅') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                )}>
                    {runResult}
                </div>
            )}

            {loading && <p className="text-slate-400 text-center py-8 animate-pulse">Carregando...</p>}

            {!loading && (
                <div className="grid gap-3">
                    {rules.map(rule => (
                        <div key={rule.id} className={cn('glass-card rounded-xl border p-4 transition-all', rule.active ? 'border-white/5' : 'border-white/5 opacity-50')}>
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={cn('w-2 h-2 rounded-full', rule.active ? 'bg-emerald-400' : 'bg-slate-600')} />
                                        <h4 className="text-sm font-bold text-white">{rule.name}</h4>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <span className="px-2 py-0.5 bg-[#5B5CFF]/15 text-[#5B5CFF] rounded text-[10px] font-medium">
                                            Evento: {EVENTS.find(e => e.value === rule.event)?.label || rule.event}
                                        </span>
                                        <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 rounded text-[10px] font-medium">
                                            Freq: {FREQUENCIES.find(f => f.value === rule.frequency)?.label || rule.frequency}
                                        </span>
                                        <span className="px-2 py-0.5 bg-cyan-500/15 text-cyan-400 rounded text-[10px] font-medium">
                                            Dest: {getRecipientLabel(rule)}
                                        </span>
                                        {Array.isArray(rule.actions) && rule.actions.map((a: any, i: number) => (
                                            <span key={i} className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 rounded text-[10px] font-medium">
                                                Ação: {ACTIONS.find(ac => ac.value === a.type)?.label || a.type}
                                            </span>
                                        ))}
                                    </div>
                                    {rule.last_run && <p className="text-[10px] text-slate-500 mt-2">Última execução: {new Date(rule.last_run).toLocaleString('pt-BR')}</p>}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => runAutomationsNow(rule.id)}
                                        disabled={runningRuleId === rule.id}
                                        className="p-1.5 rounded hover:bg-emerald-500/10 text-emerald-400/50 hover:text-emerald-400 transition-colors disabled:opacity-50"
                                        title="Executar esta regra"
                                    >
                                        {runningRuleId === rule.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                                    </button>
                                    <button onClick={() => toggleActive(rule.id, rule.active)} className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white" title={rule.active ? 'Pausar' : 'Ativar'}>
                                        {rule.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                    </button>
                                    <button onClick={() => openEdit(rule)} className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white" title="Editar">
                                        <Settings className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => deleteRule(rule.id)} className="p-1.5 rounded hover:bg-white/5 text-red-400/50 hover:text-red-400" title="Excluir">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {rules.length === 0 && <p className="text-slate-500 text-center py-8">Nenhuma automação configurada.</p>}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-card rounded-xl w-full max-w-xl p-6 border border-white/10 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">{editRule ? 'Editar Automação' : 'Nova Automação'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Nome da Regra *</label>
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Evento</label>
                                    <select value={form.event} onChange={e => setForm({ ...form, event: e.target.value })}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]">
                                        {EVENTS.map(ev => <option key={ev.value} value={ev.value} className="bg-[#0f0f14]">{ev.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Frequência</label>
                                    <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]">
                                        {FREQUENCIES.map(f => <option key={f.value} value={f.value} className="bg-[#0f0f14]">{f.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Condições (JSON)</label>
                                <textarea value={form.conditions} onChange={e => setForm({ ...form, conditions: e.target.value })} rows={3}
                                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-xs font-mono focus:outline-none focus:ring-[#00E5FF]" />
                            </div>

                            {/* Recipients Configuration */}
                            <div className="border border-white/10 rounded-lg p-3 space-y-2">
                                <label className="text-xs text-slate-400 font-medium flex items-center gap-1"><Users className="w-3 h-3" /> Destinatários da Notificação</label>
                                <select
                                    value={form.recipients.type}
                                    onChange={e => setForm({ ...form, recipients: { type: e.target.value, values: [] } })}
                                    className="w-full px-2 py-1.5 bg-black/30 border border-white/10 rounded text-white text-xs focus:outline-none"
                                >
                                    {RECIPIENT_TYPES.map(r => <option key={r.value} value={r.value} className="bg-[#0f0f14]">{r.label}</option>)}
                                </select>

                                {form.recipients.type === 'users' && (
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {users.map(u => (
                                            <label key={u.id} className="flex items-center gap-2 text-xs text-slate-300 hover:bg-white/5 px-2 py-1 rounded cursor-pointer">
                                                <input type="checkbox" checked={form.recipients.values.includes(u.id)} onChange={() => toggleRecipientValue(u.id)}
                                                    className="rounded border-white/20 bg-black/30 text-[#00E5FF]" />
                                                {u.name}
                                            </label>
                                        ))}
                                    </div>
                                )}

                                {form.recipients.type === 'roles' && (
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {roles.map(r => (
                                            <label key={r.id} className="flex items-center gap-2 text-xs text-slate-300 hover:bg-white/5 px-2 py-1 rounded cursor-pointer">
                                                <input type="checkbox" checked={form.recipients.values.includes(r.id)} onChange={() => toggleRecipientValue(r.id)}
                                                    className="rounded border-white/20 bg-black/30 text-[#00E5FF]" />
                                                {r.name}
                                            </label>
                                        ))}
                                    </div>
                                )}

                                {form.recipients.type === 'emails' && (
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="email@exemplo.com"
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
                                                className="flex-1 px-2 py-1.5 bg-black/30 border border-white/10 rounded text-white text-xs focus:outline-none" />
                                            <button onClick={addEmail} className="px-2 py-1 bg-[#00E5FF]/20 text-[#00E5FF] rounded text-xs hover:bg-[#00E5FF]/30">Adicionar</button>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {form.recipients.values.map(email => (
                                                <span key={email} className="flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded text-[10px] text-slate-300">
                                                    {email}
                                                    <button onClick={() => removeEmail(email)} className="text-red-400 hover:text-red-300"><X className="w-2.5 h-2.5" /></button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs text-slate-400">Ações</label>
                                    <button onClick={addAction} className="text-[10px] text-[#00E5FF] hover:text-white">+ Adicionar ação</button>
                                </div>
                                {form.actions.map((action, i) => (
                                    <div key={i} className="border border-white/10 rounded-lg p-3 mb-2 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <select value={action.type} onChange={e => updateAction(i, 'type', e.target.value)}
                                                className="px-2 py-1 bg-black/30 border border-white/10 rounded text-white text-xs focus:outline-none">
                                                {ACTIONS.map(a => <option key={a.value} value={a.value} className="bg-[#0f0f14]">{a.label}</option>)}
                                            </select>
                                            {form.actions.length > 1 && (
                                                <button onClick={() => removeAction(i)} className="text-red-400/50 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                            )}
                                        </div>
                                        {(action.type === 'notification' || action.type === 'email') && (
                                            <>
                                                <input value={action.title || ''} onChange={e => updateAction(i, 'title', e.target.value)} placeholder="Título"
                                                    className="w-full px-2 py-1.5 bg-black/30 border border-white/10 rounded text-white text-xs focus:outline-none" />
                                                <textarea value={action.message || ''} onChange={e => updateAction(i, 'message', e.target.value)} placeholder="Mensagem (use {placeholders})" rows={2}
                                                    className="w-full px-2 py-1.5 bg-black/30 border border-white/10 rounded text-white text-xs focus:outline-none" />
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })}
                                    className="rounded border-white/20 bg-black/30 text-[#00E5FF]" />
                                <label className="text-xs text-slate-300">Automação ativa</label>
                            </div>
                            <Button onClick={saveRule} className="w-full bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] text-white border-0 mt-2">
                                {editRule ? 'Salvar Alterações' : 'Criar Automação'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
