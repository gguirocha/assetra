"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Settings, Users, Shield, ScrollText, Bell, Zap, Server, X, Plus, Check, Trash2, AlertCircle } from 'lucide-react';
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

export default function RolesPage() {
    const pathname = usePathname();
    const [roles, setRoles] = useState<any[]>([]);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [rolePerms, setRolePerms] = useState<Record<string, string[]>>({});
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showNewRole, setShowNewRole] = useState(false);
    const [newRole, setNewRole] = useState({ name: '', description: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const initialLoadDone = useRef(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [rolesRes, permsRes, rpRes] = await Promise.all([
                supabase.from('roles').select('*').order('name'),
                supabase.from('permissions').select('*').order('module, action'),
                supabase.from('role_permissions').select('role_id, permission_id'),
            ]);

            if (rolesRes.error) { setError(`Erro ao carregar roles: ${rolesRes.error.message}`); return; }
            if (permsRes.error) { setError(`Erro ao carregar permissões: ${permsRes.error.message}`); return; }

            const r = rolesRes.data || [];
            const p = permsRes.data || [];
            const rp = rpRes.data || [];

            setRoles(r);
            setPermissions(p);

            const map: Record<string, string[]> = {};
            rp.forEach((x: any) => {
                if (!map[x.role_id]) map[x.role_id] = [];
                map[x.role_id].push(x.permission_id);
            });
            setRolePerms(map);

            // Auto-select first role only on initial load
            if (!initialLoadDone.current && r.length > 0) {
                setSelectedRole(r[0].id);
                initialLoadDone.current = true;
            }
        } catch (err: any) {
            setError('Erro inesperado: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const modules = [...new Set(permissions.map(p => p.module))];

    const togglePermission = async (roleId: string, permId: string) => {
        const current = rolePerms[roleId] || [];
        if (current.includes(permId)) {
            const { error } = await supabase.from('role_permissions').delete().eq('role_id', roleId).eq('permission_id', permId);
            if (!error) setRolePerms(prev => ({ ...prev, [roleId]: prev[roleId].filter(id => id !== permId) }));
        } else {
            const { error } = await supabase.from('role_permissions').insert({ role_id: roleId, permission_id: permId });
            if (!error) setRolePerms(prev => ({ ...prev, [roleId]: [...(prev[roleId] || []), permId] }));
        }
    };

    const createRole = async () => {
        if (!newRole.name.trim()) {
            alert('Informe o nome da role.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const { data, error: insertError } = await supabase
                .from('roles')
                .insert({ name: newRole.name.trim().toUpperCase(), description: newRole.description.trim() })
                .select()
                .single();

            if (insertError) {
                if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
                    alert(`Já existe uma role com o nome "${newRole.name.toUpperCase()}".`);
                } else {
                    alert(`Erro ao criar role: ${insertError.message}`);
                }
                return;
            }

            setShowNewRole(false);
            setNewRole({ name: '', description: '' });
            // Add to local state immediately and select it
            setRoles(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
            setSelectedRole(data.id);
        } catch (err: any) {
            alert('Erro: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const deleteRole = async (id: string) => {
        if (!confirm('Excluir esta role? Todas as permissões e atribuições de usuários serão removidas.')) return;
        try {
            await supabase.from('role_permissions').delete().eq('role_id', id);
            await supabase.from('user_roles').delete().eq('role_id', id);
            const { error } = await supabase.from('roles').delete().eq('id', id);
            if (error) { alert('Erro ao excluir: ' + error.message); return; }

            setRoles(prev => prev.filter(r => r.id !== id));
            if (selectedRole === id) {
                const remaining = roles.filter(r => r.id !== id);
                setSelectedRole(remaining.length > 0 ? remaining[0].id : null);
            }
            // Remove from local perms
            setRolePerms(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        } catch (err: any) {
            alert('Erro: ' + err.message);
        }
    };

    const selectAll = async (roleId: string, module: string) => {
        setSaving(true);
        const modulePerms = permissions.filter(p => p.module === module);
        const current = rolePerms[roleId] || [];
        const unassigned = modulePerms.filter(p => !current.includes(p.id));

        if (unassigned.length > 0) {
            // Select all
            const { error } = await supabase.from('role_permissions').insert(
                unassigned.map(p => ({ role_id: roleId, permission_id: p.id }))
            );
            if (!error) {
                setRolePerms(prev => ({
                    ...prev,
                    [roleId]: [...(prev[roleId] || []), ...unassigned.map(p => p.id)]
                }));
            }
        } else {
            // Deselect all
            for (const p of modulePerms) {
                await supabase.from('role_permissions').delete().eq('role_id', roleId).eq('permission_id', p.id);
            }
            setRolePerms(prev => ({
                ...prev,
                [roleId]: (prev[roleId] || []).filter(id => !modulePerms.some(p => p.id === id))
            }));
        }
        setSaving(false);
    };

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Settings className="w-7 h-7 text-[#00E5FF]" /> Configurações
                </h1>
            </div>
            <div className="flex gap-1 flex-wrap border-b border-white/10 pb-0">
                {TABS.map(tab => (
                    <Link key={tab.href} href={tab.href}
                        className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-all',
                            pathname === tab.href ? 'bg-white/5 text-[#00E5FF] border-b-2 border-[#00E5FF]' : 'text-slate-500 hover:text-slate-300')}>
                        <tab.icon className="w-3.5 h-3.5" />{tab.name}
                    </Link>
                ))}
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
            )}

            {loading && <p className="text-slate-400 text-center py-8 animate-pulse">Carregando roles e permissões...</p>}

            {!loading && (
                <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
                    {/* Roles list */}
                    <div className="glass-card rounded-xl border border-white/5 p-4">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-white">Roles ({roles.length})</h3>
                            <button onClick={() => setShowNewRole(true)} className="p-1 rounded hover:bg-white/10 text-[#00E5FF]"><Plus className="w-4 h-4" /></button>
                        </div>
                        {showNewRole && (
                            <div className="space-y-2 mb-3 p-3 border border-[#5B5CFF]/30 bg-[#5B5CFF]/5 rounded-lg">
                                <input
                                    value={newRole.name}
                                    onChange={e => setNewRole({ ...newRole, name: e.target.value })}
                                    placeholder="Nome da role (ex: OPERADOR)"
                                    className="w-full px-2 py-1.5 bg-black/30 border border-white/10 rounded text-white text-xs focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]"
                                    onKeyDown={e => { if (e.key === 'Enter') createRole(); }}
                                    autoFocus
                                />
                                <input
                                    value={newRole.description}
                                    onChange={e => setNewRole({ ...newRole, description: e.target.value })}
                                    placeholder="Descrição (opcional)"
                                    className="w-full px-2 py-1.5 bg-black/30 border border-white/10 rounded text-white text-xs focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF]"
                                    onKeyDown={e => { if (e.key === 'Enter') createRole(); }}
                                />
                                <div className="flex gap-1">
                                    <Button size="sm" onClick={createRole} disabled={saving || !newRole.name.trim()}
                                        className="text-[10px] bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] text-white border-0 flex-1">
                                        {saving ? 'Criando...' : 'Criar Role'}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => { setShowNewRole(false); setNewRole({ name: '', description: '' }); }}
                                        className="text-[10px] text-slate-400 border border-white/10 flex-1">Cancelar</Button>
                                </div>
                            </div>
                        )}
                        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                            {roles.map(r => (
                                <div key={r.id} onClick={() => setSelectedRole(r.id)}
                                    className={cn('flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all text-xs',
                                        selectedRole === r.id ? 'bg-[#5B5CFF]/15 text-[#5B5CFF] border border-[#5B5CFF]/30' : 'text-slate-300 hover:bg-white/5 border border-transparent')}>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium">{r.name}</div>
                                        {r.description && <div className="text-[10px] text-slate-500 truncate">{r.description}</div>}
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); deleteRole(r.id); }}
                                        className="text-red-400/30 hover:text-red-400 p-1 ml-1 flex-shrink-0">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {roles.length === 0 && <p className="text-slate-500 text-xs text-center py-4">Nenhuma role cadastrada.</p>}
                        </div>
                    </div>

                    {/* Permissions matrix */}
                    <div className="glass-card rounded-xl border border-white/5 p-4">
                        {!selectedRole ? (
                            <div className="text-center py-12">
                                <Shield className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-500 text-sm">Selecione uma role para gerenciar permissões</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-white">
                                        Permissões: <span className="text-[#00E5FF]">{roles.find(r => r.id === selectedRole)?.name}</span>
                                    </h3>
                                    <span className="text-[10px] text-slate-500">
                                        {(rolePerms[selectedRole] || []).length}/{permissions.length} atribuídas
                                    </span>
                                </div>
                                {permissions.length === 0 && (
                                    <div className="text-center py-8">
                                        <AlertCircle className="w-8 h-8 text-amber-500/50 mx-auto mb-2" />
                                        <p className="text-slate-500 text-xs">Nenhuma permissão encontrada. Execute o SQL de seed das permissões.</p>
                                    </div>
                                )}
                                {modules.map(mod => {
                                    const modPerms = permissions.filter(p => p.module === mod);
                                    const assignedCount = modPerms.filter(p => (rolePerms[selectedRole!] || []).includes(p.id)).length;
                                    const moduleLabels: Record<string, string> = {
                                        fleet: '🚛 Frota', maintenance: '🔧 Manutenção', inventory: '📦 Estoque',
                                        fuel: '⛽ Abastecimento', carwash: '🫧 Lava-Jato', admin: '👤 Administração'
                                    };
                                    return (
                                        <div key={mod} className="border border-white/5 rounded-lg overflow-hidden">
                                            <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02] border-b border-white/5">
                                                <span className="text-xs font-semibold text-white">{moduleLabels[mod] || mod.toUpperCase()}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={cn('text-[10px] font-medium',
                                                        assignedCount === modPerms.length ? 'text-emerald-400' : 'text-slate-500')}>
                                                        {assignedCount}/{modPerms.length}
                                                    </span>
                                                    <button onClick={() => selectAll(selectedRole!, mod)} disabled={saving}
                                                        className="text-[10px] text-[#00E5FF] hover:text-white transition-colors disabled:opacity-50">
                                                        {assignedCount === modPerms.length ? 'Remover todos' : 'Selecionar todos'}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                                                {modPerms.map(p => {
                                                    const isActive = (rolePerms[selectedRole!] || []).includes(p.id);
                                                    return (
                                                        <div key={p.id} onClick={() => togglePermission(selectedRole!, p.id)}
                                                            className={cn('flex items-center gap-2 px-3 py-2 cursor-pointer transition-all border-b border-r border-white/5',
                                                                isActive ? 'bg-emerald-500/5' : 'hover:bg-white/[0.02]')}>
                                                            <div className={cn('w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0',
                                                                isActive ? 'bg-emerald-500 border-emerald-500' : 'border-white/20')}>
                                                                {isActive && <Check className="w-2.5 h-2.5 text-white" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-[11px] text-white font-mono truncate">{p.action}</div>
                                                                <div className="text-[9px] text-slate-500">{p.description}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
