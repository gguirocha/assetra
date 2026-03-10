-- 011_team_management.sql

-- Adicionar campo de escala/disponibilidade e outras configurações aos técnicos de manutenção

ALTER TABLE public.maintenance_technicians 
ADD COLUMN IF NOT EXISTS work_schedule VARCHAR(100) DEFAULT 'Seg-Sex, 08h as 18h',
ADD COLUMN IF NOT EXISTS max_active_os INT DEFAULT 5; -- Carga máxima ideal para cálculo de atribuição automática

-- Habilitar RLS se não estiver
ALTER TABLE public.maintenance_technicians ENABLE ROW LEVEL SECURITY;

-- Politicas para maintenance_technicians (se ainda não existem)
DROP POLICY IF EXISTS "p_maintenance_technicians_all" ON public.maintenance_technicians;
CREATE POLICY p_maintenance_technicians_all ON public.maintenance_technicians
    FOR ALL
    USING (tenant_id = get_auth_tenant_id() OR is_global_admin());

-- Re-executar trigger pro updated_at (caso a tabela ganhe a coluna futuramente, mas já tem no 002)
ALTER TABLE public.maintenance_technicians ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
DROP TRIGGER IF EXISTS handle_updated_at_mt ON public.maintenance_technicians;
CREATE TRIGGER handle_updated_at_mt BEFORE UPDATE ON public.maintenance_technicians FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime (updated_at);
