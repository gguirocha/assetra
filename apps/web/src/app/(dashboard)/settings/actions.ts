'use server';

import { createClient } from '@supabase/supabase-js';

export async function createAdminUserAction(form: any, tenantId: string) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return { error: 'Chaves do Supabase ausentes no servidor.' };
    }

    // Usar a chave service_role para contornar RLS e não alterar a sessão auth atual
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );

    try {
        // 1. Gerar senha temporária
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let tempPassword = '';
        for (let i = 0; i < 10; i++) tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        tempPassword += 'A1!';

        // 2. Criar usuário na tabela auth.users via Admin API
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: form.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { name: form.name }
        });

        if (authError) return { error: authError.message };
        if (!authData.user) return { error: 'Falha ao criar o usuário base.' };

        // 3. O Trigger "on_user_created" no BD já insere a linha em user_profiles com id e name.
        // Portanto, devemos fazer um UPDATE (bypassing RLS pelo admin) e não um INSERT.
        const { error: profileError } = await supabaseAdmin.from('user_profiles').update({
            tenant_id: tenantId,
            phone: form.phone,
            job_title: form.job_title,
            cost_center: form.cost_center,
            unit: form.unit,
            email: form.email,
            is_admin: form.is_admin,
            must_change_password: true,
            active: true
        }).eq('id', authData.user.id);

        if (profileError) {
            // Rollback em caso de erro no profile
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            return { error: `Erro ao atualizar perfil: ${profileError.message}` };
        }

        // 4. Inserir Roles (Papéis de Acesso)
        if (form.roles && form.roles.length > 0) {
            const roleInserts = form.roles.map((roleId: string) => ({
                user_id: authData.user.id,
                role_id: roleId,
            }));
            const { error: rolesError } = await supabaseAdmin.from('user_roles').insert(roleInserts);
            if (rolesError) return { error: `Erro ao atribuir permissões: ${rolesError.message}` };
        }

        // 5. Disparar email de redefinição de senha pelo Supabase para o novo usuário
        //    Isso gera um link seguro para o usuário definir sua própria senha
        try {
            const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
                ? `https://${process.env.VERCEL_URL}` 
                : 'http://localhost:3000';
            
            await supabaseAdmin.auth.admin.generateLink({
                type: 'recovery',
                email: form.email,
                options: {
                    redirectTo: `${origin}/update-password`,
                }
            });
        } catch {
            // Non-critical: the invite email already has the temp password
        }

        return { success: true, user: authData.user, tempPassword };
    } catch (err: any) {
        return { error: err.message };
    }
}
