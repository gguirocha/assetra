"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

interface PermissionsContextType {
    permissions: string[];    // e.g. ["fleet.vehicles.read", "maintenance.orders.write"]
    isAdmin: boolean;
    loading: boolean;
    hasPermission: (action: string) => boolean;
    hasModuleAccess: (module: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType>({
    permissions: [],
    isAdmin: false,
    loading: true,
    hasPermission: () => false,
    hasModuleAccess: () => false,
});

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [permissions, setPermissions] = useState<string[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setPermissions([]);
            setIsAdmin(false);
            setLoading(false);
            return;
        }

        async function loadPermissions() {
            setLoading(true);
            try {
                // 1. Check if user is admin (admins bypass all permissions)
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('is_admin')
                    .eq('id', user!.id)
                    .single();

                if (profile?.is_admin) {
                    setIsAdmin(true);
                    setPermissions([]);
                    setLoading(false);
                    return;
                }

                // 2. Get user's roles
                const { data: userRoles } = await supabase
                    .from('user_roles')
                    .select('role_id')
                    .eq('user_id', user!.id);

                if (!userRoles || userRoles.length === 0) {
                    setPermissions([]);
                    setIsAdmin(false);
                    setLoading(false);
                    return;
                }

                const roleIds = userRoles.map(r => r.role_id);

                // 3. Get permissions assigned to those roles
                const { data: rolePerms } = await supabase
                    .from('role_permissions')
                    .select('permission_id')
                    .in('role_id', roleIds);

                if (!rolePerms || rolePerms.length === 0) {
                    setPermissions([]);
                    setIsAdmin(false);
                    setLoading(false);
                    return;
                }

                const permIds = [...new Set(rolePerms.map(rp => rp.permission_id))];

                // 4. Get actual permission action names
                const { data: perms } = await supabase
                    .from('permissions')
                    .select('action')
                    .in('id', permIds);

                if (perms) {
                    setPermissions(perms.map(p => p.action));
                }

                setIsAdmin(false);
            } catch (err) {
                console.error('Error loading permissions:', err);
                setPermissions([]);
                setIsAdmin(false);
            } finally {
                setLoading(false);
            }
        }

        loadPermissions();
    }, [user]);

    const hasPermission = (action: string): boolean => {
        if (isAdmin) return true;
        return permissions.includes(action);
    };

    const hasModuleAccess = (module: string): boolean => {
        if (isAdmin) return true;
        // Check if user has ANY permission that starts with the module prefix
        return permissions.some(p => p.startsWith(module + '.'));
    };

    return (
        <PermissionsContext.Provider value={{ permissions, isAdmin, loading, hasPermission, hasModuleAccess }}>
            {children}
        </PermissionsContext.Provider>
    );
}

export const usePermissions = () => useContext(PermissionsContext);
