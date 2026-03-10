import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: join(__dirname, '../../../../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Variáveis de ambiente do Supabase ausentes. Serviços que dependem do Supabase Adminirão falhar.');
}

// Cliente com SERVICE ROLE (Acesso total, contorna RLS)
// USE SOMENTE NO BACKEND! NUNCA EXPOR ESTA CHAVE!
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
