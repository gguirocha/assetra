"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Settings, Users, Shield, ScrollText, Bell, Zap, Server, Save, Mail } from 'lucide-react';
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

type Setting = { key: string; value: string; label: string; type: 'text' | 'number' | 'password' | 'email' | 'toggle'; };

const SMTP_FIELDS: Setting[] = [
    { key: 'smtp_host', value: '', label: 'Servidor SMTP', type: 'text' },
    { key: 'smtp_port', value: '587', label: 'Porta', type: 'number' },
    { key: 'smtp_user', value: '', label: 'Usuário', type: 'email' },
    { key: 'smtp_pass', value: '', label: 'Senha', type: 'password' },
    { key: 'smtp_from', value: '', label: 'E-mail remetente', type: 'email' },
    { key: 'smtp_from_name', value: 'Assetra', label: 'Nome remetente', type: 'text' },
];

const SLA_FIELDS: Setting[] = [
    { key: 'sla_urgente_hours', value: '4', label: 'SLA Urgente (horas)', type: 'number' },
    { key: 'sla_alta_hours', value: '8', label: 'SLA Alta (horas)', type: 'number' },
    { key: 'sla_media_hours', value: '24', label: 'SLA Média (horas)', type: 'number' },
    { key: 'sla_baixa_hours', value: '72', label: 'SLA Baixa (horas)', type: 'number' },
    { key: 'reminder_days_before', value: '30', label: 'Dias de antecedência para alertas', type: 'number' },
    { key: 'wash_frequency_default', value: '15', label: 'Frequência padrão lavagem (dias)', type: 'number' },
    { key: 'stock_alert_enabled', value: 'true', label: 'Alertas de estoque baixo', type: 'toggle' },
    { key: 'email_notifications_enabled', value: 'false', label: 'Enviar notificações por e-mail', type: 'toggle' },
];

export default function SystemPage() {
    const pathname = usePathname();
    const [smtpValues, setSmtpValues] = useState<Record<string, string>>({});
    const [slaValues, setSlaValues] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingEmail, setTestingEmail] = useState(false);

    const loadSettings = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from('system_settings').select('*');
        if (data) {
            const smtp: Record<string, string> = {};
            const sla: Record<string, string> = {};
            data.forEach((s: any) => {
                if (s.category === 'smtp') smtp[s.key] = s.value || '';
                else sla[s.key] = s.value || '';
            });
            // Fill defaults
            SMTP_FIELDS.forEach(f => { if (!smtp[f.key]) smtp[f.key] = f.value; });
            SLA_FIELDS.forEach(f => { if (!sla[f.key]) sla[f.key] = f.value; });
            setSmtpValues(smtp);
            setSlaValues(sla);
        } else {
            const smtp: Record<string, string> = {};
            const sla: Record<string, string> = {};
            SMTP_FIELDS.forEach(f => smtp[f.key] = f.value);
            SLA_FIELDS.forEach(f => sla[f.key] = f.value);
            setSmtpValues(smtp);
            setSlaValues(sla);
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadSettings(); }, [loadSettings]);

    const saveSettings = async (category: string, values: Record<string, string>) => {
        setSaving(true);
        const tenantRes = await supabase.from('tenants').select('id').limit(1).single();
        const tid = tenantRes.data?.id;
        for (const [key, value] of Object.entries(values)) {
            await supabase.from('system_settings').upsert({
                tenant_id: tid, category, key, value, updated_at: new Date().toISOString()
            }, { onConflict: 'tenant_id,category,key' });
        }
        setSaving(false);
        alert('Configurações salvas!');
    };

    const testEmail = async () => {
        setTestingEmail(true);
        try {
            const testTo = smtpValues.smtp_from || smtpValues.smtp_user;
            const res = await fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'test', to: testTo }),
            });
            const result = await res.json();
            if (res.ok) {
                alert(`✅ ${result.message}\n\nE-mail enviado para: ${testTo}`);
            } else {
                alert(`❌ Falha: ${result.error}`);
            }
        } catch (err: any) {
            alert(`❌ Erro: ${err.message}`);
        } finally {
            setTestingEmail(false);
        }
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

            {loading && <p className="text-slate-400 text-center py-8 animate-pulse">Carregando...</p>}

            {!loading && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* SMTP */}
                    <div className="glass-card rounded-xl border border-white/5 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Mail className="w-5 h-5 text-[#00E5FF]" />
                            <h3 className="text-sm font-bold text-white">Configurações de E-mail (SMTP)</h3>
                        </div>
                        <div className="space-y-3">
                            {SMTP_FIELDS.map(f => (
                                <div key={f.key}>
                                    <label className="text-xs text-slate-400 block mb-1">{f.label}</label>
                                    <input type={f.type} value={smtpValues[f.key] || ''}
                                        onChange={e => setSmtpValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]" />
                                </div>
                            ))}
                            <div className="flex gap-2 pt-2">
                                <Button size="sm" onClick={() => saveSettings('smtp', smtpValues)} disabled={saving}
                                    className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] text-white border-0 text-xs flex-1">
                                    <Save className="w-3 h-3 mr-1" /> {saving ? 'Salvando...' : 'Salvar SMTP'}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={testEmail} disabled={testingEmail}
                                    className="border border-white/10 text-slate-400 text-xs">
                                    {testingEmail ? 'Testando...' : 'Testar'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* SLA & Parâmetros Globais */}
                    <div className="glass-card rounded-xl border border-white/5 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Server className="w-5 h-5 text-[#00E5FF]" />
                            <h3 className="text-sm font-bold text-white">Parâmetros Globais</h3>
                        </div>
                        <div className="space-y-3">
                            {SLA_FIELDS.map(f => (
                                <div key={f.key}>
                                    {f.type === 'toggle' ? (
                                        <div className="flex items-center justify-between py-1">
                                            <label className="text-xs text-slate-300">{f.label}</label>
                                            <button onClick={() => setSlaValues(prev => ({ ...prev, [f.key]: prev[f.key] === 'true' ? 'false' : 'true' }))}
                                                className={cn('w-10 h-5 rounded-full transition-all relative',
                                                    slaValues[f.key] === 'true' ? 'bg-[#00E5FF]' : 'bg-slate-600')}>
                                                <div className={cn('w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all',
                                                    slaValues[f.key] === 'true' ? 'left-5' : 'left-0.5')} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <label className="text-xs text-slate-400 block mb-1">{f.label}</label>
                                            <input type={f.type} value={slaValues[f.key] || ''}
                                                onChange={e => setSlaValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                                                className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]" />
                                        </>
                                    )}
                                </div>
                            ))}
                            <Button size="sm" onClick={() => saveSettings('general', slaValues)} disabled={saving}
                                className="w-full bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] text-white border-0 text-xs mt-2">
                                <Save className="w-3 h-3 mr-1" /> {saving ? 'Salvando...' : 'Salvar Parâmetros'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
