-- 013_car_wash.sql
-- Regras automáticas de lavagem e melhorias na tabela de agendamentos

-- 1. Tabela de regras automáticas de lavagem
CREATE TABLE IF NOT EXISTS public.car_wash_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL, -- Ex: "Caminhões ativos - 15 dias"
    vehicle_type VARCHAR(50) NOT NULL, -- tipo de veículo que a regra aplica
    frequency_days INT NOT NULL DEFAULT 15, -- A cada N dias
    delay_alert_days INT NOT NULL DEFAULT 3, -- Notificar gestor se atrasar N dias
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Adicionar campo de conclusão e notas na tabela de agendamentos
ALTER TABLE public.car_wash_schedules
ADD COLUMN IF NOT EXISTS completion_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- RLS
ALTER TABLE public.car_wash_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_wash_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p_car_wash_rules_all" ON public.car_wash_rules;
CREATE POLICY p_car_wash_rules_all ON public.car_wash_rules
    FOR ALL USING (tenant_id = get_auth_tenant_id() OR is_global_admin());

DROP POLICY IF EXISTS "p_car_wash_schedules_all" ON public.car_wash_schedules;
CREATE POLICY p_car_wash_schedules_all ON public.car_wash_schedules
    FOR ALL USING (tenant_id = get_auth_tenant_id() OR is_global_admin());

-- Índices
CREATE INDEX IF NOT EXISTS idx_cw_schedules_vehicle ON public.car_wash_schedules(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_cw_schedules_date ON public.car_wash_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_cw_rules_type ON public.car_wash_rules(vehicle_type);
