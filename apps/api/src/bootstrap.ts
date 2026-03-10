import { supabaseAdmin } from './services/supabase';

export async function bootstrapAdmin() {
    console.log('--- Verificando Admin Bootstrap ---');

    const email = process.env.ADMIN_DEFAULT_EMAIL || 'admin@local';
    const password = process.env.ADMIN_DEFAULT_PASSWORD || 'admin';

    try {
        // 1. O ideal é checar se o user existe na tabela auth.users. 
        // Como a API admin do Supabase permite listar usuários via admin.listUsers() ou tentar criar,
        // vamos tentar criar e capturar o erro se já existir.

        const { data: { user }, error: signupError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name: 'Administrador do Sistema' }
        });

        if (signupError) {
            if (signupError.message.includes('already exists') || signupError.message.includes('registered')) {
                console.log(`Usuário ${email} já existe. Bootstrap ignorado.`);
                return;
            }
            throw signupError;
        }

        if (!user) {
            throw new Error('Falha ao criar usuário, sem retorno.');
        }

        console.log(`Usuário auth.users admin criado com sucesso. ID: ${user.id}.`);

        // Atualiza a flag isAdmin no user_profiles
        // (a trigger no SQL já deve ter criado o profile vazio)
        // Vamos garantir um delay para a trigger do Postgres rodar.
        await new Promise(resolve => setTimeout(resolve, 500));

        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .update({
                is_admin: true,
                must_change_password: true,
            })
            .eq('id', user.id);

        if (profileError) {
            console.error('Erro ao atualizar user_profile com is_admin', profileError);
        } else {
            console.log(`Profile atualizado como is_admin para ${email}.`);
        }

        // Atribuir papel 'ADMIN' (roles e user_roles)
        const { data: role } = await supabaseAdmin.from('roles').select('id').eq('name', 'ADMIN').single();
        if (role) {
            const { error: userRoleError } = await supabaseAdmin
                .from('user_roles')
                .insert({ user_id: user.id, role_id: role.id });
            if (!userRoleError) {
                console.log(`Role ADMIN vinculada ao usuário ${email}.`);
            }
        }

    } catch (error) {
        console.error('Erro no bootstrap de admin:', error);
    }
}
