-- 012_os_portals.sql
-- Novas colunas e tabela para o Portal do Técnico/Solicitante e Timeline de Comentários

-- 1. OS Number sequencial e legível (ex: OS-0001)
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS os_number SERIAL;

-- 2. Data de aceite pelo técnico
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS accepted_date TIMESTAMP WITH TIME ZONE;

-- 3. Tabela de comentários / timeline de atualizações da OS
CREATE TABLE IF NOT EXISTS public.work_order_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    author_name VARCHAR(255) NOT NULL,
    author_role VARCHAR(50) NOT NULL DEFAULT 'solicitante', -- 'solicitante', 'tecnico', 'sistema'
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS para work_order_comments
ALTER TABLE public.work_order_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p_work_order_comments_select" ON public.work_order_comments;
CREATE POLICY p_work_order_comments_select ON public.work_order_comments
    FOR SELECT USING (true); -- Todos podem ler comentários das OS que tem acesso

DROP POLICY IF EXISTS "p_work_order_comments_insert" ON public.work_order_comments;
CREATE POLICY p_work_order_comments_insert ON public.work_order_comments
    FOR INSERT WITH CHECK (true); -- Solicitante e técnico podem inserir

DROP POLICY IF EXISTS "p_work_order_comments_delete" ON public.work_order_comments;
CREATE POLICY p_work_order_comments_delete ON public.work_order_comments
    FOR DELETE USING (is_global_admin()); -- Só admin pode deletar comentários

-- Índice para busca rápida de comentários por OS
CREATE INDEX IF NOT EXISTS idx_wo_comments_order_id ON public.work_order_comments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_os_number ON public.work_orders(os_number);
