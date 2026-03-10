import { FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';

// Usar client normal para verificar JWT que vem do header Authorization
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function verifyJWT(request: FastifyRequest, reply: FastifyReply) {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader) {
            return reply.code(401).send({ error: 'Token não fornecido' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return reply.code(401).send({ error: 'Token inválido/expirado' });
        }

        // Pendurar o user no request para os próximos guards
        (request as any).user = user;

    } catch (err) {
        return reply.code(500).send({ error: 'Erro de Autenticação' });
    }
}

// Handler de RBAC: deve ser usado DEPOIS do verifyJWT
export function requirePermission(actionStr: string) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = (request as any).user;
        if (!user) return reply.code(401).send({ error: 'Não Autenticado' });

        // Implementação real da checagem:
        // No Postgres, vc buscaria as permissões do usuário em `role_permissions`
        // Como a API admin (service role) checa o banco, faríamos um select aqui.
        // 
        // Exemplo Simples (usando o supabaseAdmin internamente para checar o banco):
        // const { supabaseAdmin } = await import('../services/supabase');
        // const { data, error } = await supabaseAdmin.rpc('check_user_permission', { p_user_id: user.id, p_action: actionStr });
        // if (!data) return reply.code(403).send(...);

        // Obs: para este escopo, a função existe como placeholder ou usará uma Query SupabaseAdmin.
        // (Pode tbm checar a flag is_admin direto do user_profiles se for admin global).
    };
}
