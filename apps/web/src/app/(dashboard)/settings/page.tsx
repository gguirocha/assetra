"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { createAdminUserAction } from './actions';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Settings, Users, Shield, ScrollText, Bell, Zap, Server, X, Plus, Eye, EyeOff, UserPlus, Search, Mail, RotateCcw, ChevronDown } from 'lucide-react';
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

type UserProfile = {
    id: string;
    name: string;
    phone: string;
    job_title: string;
    cost_center: string;
    unit: string;
    is_admin: boolean;
    active: boolean;
    created_at: string;
    email?: string;
    roles?: string[];
};

export default function SettingsUsersPage() {
    const { user } = useAuth();
    const pathname = usePathname();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editUser, setEditUser] = useState<UserProfile | null>(null);
    const [form, setForm] = useState({ name: '', email: '', phone: '', job_title: '', cost_center: '', unit: '', is_admin: false, is_technician: false, technician_service_types: [] as string[], roles: [] as string[] });
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        const [{ data: usersData }, { data: rolesData }] = await Promise.all([
            supabase.from('user_profiles').select('*').order('name'),
            supabase.from('roles').select('*').order('name'),
        ]);

        if (usersData) {
            // Get user roles
            const { data: userRolesData } = await supabase.from('user_roles').select('user_id, roles(name)');
            const rolesMap: Record<string, string[]> = {};
            if (userRolesData) {
                userRolesData.forEach((ur: any) => {
                    if (!rolesMap[ur.user_id]) rolesMap[ur.user_id] = [];
                    rolesMap[ur.user_id].push(ur.roles?.name || '');
                });
            }
            setUsers(usersData.map((u: any) => ({ ...u, roles: rolesMap[u.id] || [] })));
        }
        if (rolesData) setRoles(rolesData);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const filteredUsers = users.filter(u =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.job_title?.toLowerCase().includes(search.toLowerCase()) ||
        u.cost_center?.toLowerCase().includes(search.toLowerCase())
    );

    const handleCreateUser = async () => {
        if (!form.name || !form.email) return;
        setSaving(true);
        try {
            const tenantRes = await supabase.from('tenants').select('id').limit(1).single();
            const tenantId = tenantRes.data?.id;
            
            if (!tenantId) throw new Error('Sua organização (Tenant) não foi encontrada.');

            const result = await createAdminUserAction(form, tenantId);
            
            if (result.error) throw new Error(result.error);
            if (!result.success) throw new Error('Erro desconhecido na criação do usuário.');

            const tempPassword = result.tempPassword;

            // Send invite email via SMTP
            try {
                const loginUrl = `${window.location.origin}/login`;
                const emailRes = await fetch('/api/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'invite',
                        to: form.email,
                        userName: form.name,
                        tempPassword,
                        loginUrl,
                    }),
                });
                const emailResult = await emailRes.json();
                if (emailRes.ok) {
                    alert(`✅ Usuário criado com sucesso!\n\n📧 Um e-mail com as credenciais foi enviado para ${form.email}`);
                } else {
                    alert(`✅ Usuário criado!\n\n⚠️ Não foi possível enviar e-mail: ${emailResult.error}\n\nSenha temporária: ${tempPassword}`);
                }
            } catch {
                alert(`✅ Usuário criado!\n\n⚠️ Erro ao enviar e-mail. Informe a senha manualmente.\nSenha temporária: ${tempPassword}`);
            }

            setShowModal(false);
            setForm({ name: '', email: '', phone: '', job_title: '', cost_center: '', unit: '', is_admin: false, is_technician: false, technician_service_types: [], roles: [] });
            loadData();
        } catch (err: any) {
            alert('Erro: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateUser = async () => {
        if (!editUser) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('user_profiles').update({
                name: form.name,
                email: form.email,
                phone: form.phone,
                job_title: form.job_title,
                cost_center: form.cost_center,
                unit: form.unit,
                is_admin: form.is_admin,
                is_technician: form.is_technician,
                technician_service_types: form.is_technician ? form.technician_service_types : [],
            }).eq('id', editUser.id);

            if (error) throw error;

            // Update roles
            await supabase.from('user_roles').delete().eq('user_id', editUser.id);
            if (form.roles.length > 0) {
                await supabase.from('user_roles').insert(form.roles.map(roleId => ({ user_id: editUser.id, role_id: roleId })));
            }

            setEditUser(null);
            setShowModal(false);
            loadData();
        } catch (err: any) {
            alert('Erro: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (userId: string, currentActive: boolean) => {
        await supabase.from('user_profiles').update({ active: !currentActive }).eq('id', userId);
        loadData();
    };

    const resetPassword = async (u: UserProfile) => {
        if (!u.email) { alert('Usuário sem e-mail cadastrado.'); return; }
        try {
            // Send reset via Supabase
            const { error } = await supabase.auth.resetPasswordForEmail(u.email, {
                redirectTo: `${window.location.origin}/update-password`,
            });
            if (error) throw error;

            // Also try our SMTP
            await fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset_password', to: u.email, userName: u.name, resetUrl: `${window.location.origin}/update-password` }),
            });

            await supabase.from('user_profiles').update({ must_change_password: true }).eq('id', u.id);
            alert(`📧 E-mail de redefinição de senha enviado para ${u.email}`);
        } catch (err: any) {
            alert('Erro: ' + err.message);
        }
    };

    const openEdit = (u: UserProfile) => {
        setEditUser(u);
        setForm({
            name: u.name || '',
            email: u.email || '',
            phone: u.phone || '',
            job_title: u.job_title || '',
            cost_center: u.cost_center || '',
            unit: u.unit || '',
            is_admin: u.is_admin,
            is_technician: (u as any).is_technician || false,
            technician_service_types: (u as any).technician_service_types || [],
            roles: [],
        });
        // Load user roles
        supabase.from('user_roles').select('role_id').eq('user_id', u.id).then(({ data }) => {
            if (data) setForm(prev => ({ ...prev, roles: data.map((r: any) => r.role_id) }));
        });
        setShowModal(true);
    };

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Settings className="w-7 h-7 text-[#00E5FF]" /> Configurações
                </h1>
                <p className="text-slate-400 mt-0.5 text-sm">Gerencie usuários, permissões, automações e configurações do sistema.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 flex-wrap border-b border-white/10 pb-0">
                {TABS.map(tab => {
                    const isActive = pathname === tab.href;
                    return (
                        <Link key={tab.href} href={tab.href}
                            className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-all',
                                isActive
                                    ? 'bg-white/5 text-[#00E5FF] border-b-2 border-[#00E5FF]'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'
                            )}>
                            <tab.icon className="w-3.5 h-3.5" />
                            {tab.name}
                        </Link>
                    );
                })}
            </div>

            {/* User Management */}
            <div className="flex justify-between items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]"
                        placeholder="Buscar usuário..." />
                </div>
                <Button size="sm" onClick={() => { setEditUser(null); setForm({ name: '', email: '', phone: '', job_title: '', cost_center: '', unit: '', is_admin: false, is_technician: false, technician_service_types: [], roles: [] }); setShowModal(true); }}
                    className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] text-white border-0 text-xs">
                    <UserPlus className="w-3.5 h-3.5 mr-1" /> Novo Usuário
                </Button>
            </div>

            {loading && <p className="text-slate-400 text-center py-8 animate-pulse">Carregando...</p>}

            {!loading && (
                <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5 text-slate-400 text-xs">
                                <th className="text-left p-3">Nome</th>
                                <th className="text-left p-3">E-mail</th>
                                <th className="text-left p-3">Cargo</th>
                                <th className="text-left p-3">Unidade</th>
                                <th className="text-left p-3">Roles</th>
                                <th className="text-center p-3">Status</th>
                                <th className="text-center p-3">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(u => (
                                <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                    <td className="p-3">
                                        <div className="text-white font-medium">{u.name || '-'}</div>
                                        <div className="text-slate-500 text-[10px] font-mono">{u.phone || ''}</div>
                                    </td>
                                    <td className="p-3 text-slate-400 text-xs font-mono">{u.email || '-'}</td>
                                    <td className="p-3 text-slate-300">{u.job_title || '-'}</td>
                                    <td className="p-3 text-slate-300">{u.unit || '-'}</td>
                                    <td className="p-3">
                                        <div className="flex gap-1 flex-wrap">
                                            {u.roles?.map(r => (
                                                <span key={r} className="px-1.5 py-0.5 rounded text-[9px] bg-[#5B5CFF]/20 text-[#5B5CFF] font-medium">{r}</span>
                                            ))}
                                            {u.is_admin && <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-400 font-medium">ADMIN</span>}
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${u.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {u.active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors" title="Editar">
                                                <Settings className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => toggleActive(u.id, u.active)} className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors" title={u.active ? 'Desativar' : 'Ativar'}>
                                                {u.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                            </button>
                                            <button onClick={() => resetPassword(u)} className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors" title="Resetar senha">
                                                <RotateCcw className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr><td colSpan={8} className="text-center text-slate-500 py-8">Nenhum usuário encontrado.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal Criar/Editar */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-card rounded-xl w-full max-w-lg p-6 border border-white/10 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">{editUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Nome *</label>
                                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">E-mail *</label>
                                    <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email"
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Telefone</label>
                                    <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Cargo</label>
                                    <input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Centro de Custo</label>
                                    <input value={form.cost_center} onChange={e => setForm({ ...form, cost_center: e.target.value })}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Unidade</label>
                                    <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:ring-[#00E5FF]" />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                                <input type="checkbox" checked={form.is_admin} onChange={e => setForm({ ...form, is_admin: e.target.checked })}
                                    className="rounded border-white/20 bg-black/30 text-[#00E5FF] focus:ring-[#00E5FF]" />
                                <label className="text-xs text-slate-300">Administrador do sistema</label>
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                                <input type="checkbox" checked={form.is_technician} onChange={e => setForm({ ...form, is_technician: e.target.checked, technician_service_types: e.target.checked ? (form.technician_service_types.length > 0 ? form.technician_service_types : ['vehicle', 'machine', 'facility']) : [] })}
                                    className="rounded border-white/20 bg-black/30 text-[#00E5FF] focus:ring-[#00E5FF]" />
                                <label className="text-xs text-slate-300">Técnico de Manutenção</label>
                            </div>

                            {form.is_technician && (
                                <div className="mt-2 p-3 bg-black/30 border border-white/5 rounded-lg">
                                    <label className="text-xs text-slate-400 block mb-2">Tipos de Serviço do Técnico</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {[{v:'vehicle',l:'🚗 Veículos'},{v:'machine',l:'⚙️ Máquinas'},{v:'facility',l:'🏢 Predial'}].map(opt => {
                                            const checked = form.technician_service_types.includes(opt.v);
                                            return (
                                                <button key={opt.v} type="button"
                                                    onClick={() => {
                                                        const next = checked ? form.technician_service_types.filter(t => t !== opt.v) : [...form.technician_service_types, opt.v];
                                                        setForm({ ...form, technician_service_types: next.length > 0 ? next : [opt.v] });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${checked ? 'border-[#00E5FF] bg-[#00E5FF]/10 text-[#00E5FF]' : 'border-white/10 bg-black/20 text-slate-400 hover:border-white/20'}`}>
                                                    {opt.l}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-xs text-slate-400 block mb-2">Roles</label>
                                <div className="flex flex-wrap gap-2">
                                    {roles.map(r => {
                                        const isSelected = form.roles.includes(r.id);
                                        return (
                                            <button key={r.id}
                                                onClick={() => setForm(prev => ({ ...prev, roles: isSelected ? prev.roles.filter(id => id !== r.id) : [...prev.roles, r.id] }))}
                                                className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${isSelected ? 'border-[#5B5CFF] bg-[#5B5CFF]/20 text-[#5B5CFF]' : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}>
                                                {r.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <Button onClick={editUser ? handleUpdateUser : handleCreateUser} disabled={saving}
                                className="w-full bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] text-white border-0 mt-2">
                                {saving ? 'Salvando...' : editUser ? 'Salvar Alterações' : 'Criar Usuário'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
