-- 009_maintenance_module.sql

-- ==========================================
-- 8. MAINTENANCE CATALOGS & PREVENTIVE PLANS
-- ==========================================

-- Catálogo de Tipos de Manutenção (ex: Preventiva, Corretiva)
CREATE TABLE IF NOT EXISTS public.maintenance_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_preventive BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Catálogo de Serviços (ex: Troca de Óleo, Revisão)
CREATE TABLE IF NOT EXISTS public.maintenance_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    sla_hours NUMERIC(10,2) DEFAULT 24.0, -- SLA Padrão para este serviço
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Planos de Manutenção Preventiva por Veículo ou tipo
CREATE TABLE IF NOT EXISTS public.preventive_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL, -- 'km', 'days', 'both'
    trigger_km NUMERIC(10,2), -- Ex: a cada 10000 km
    trigger_days INT,         -- Ex: a cada 180 dias
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE, -- opcional, se for plano específico. Se NULL, pode ser generalizado no futuro, mas manteremos FK por enquanto direto pro veiculo
    machine_id UUID REFERENCES public.assets_machines(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES public.assets_facilities(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.maintenance_services(id) ON DELETE SET NULL, 
    last_triggered_km NUMERIC(10,2),
    last_triggered_date DATE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.maintenance_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preventive_plans ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Tenants can manage their maintenance types"
    ON public.maintenance_types
    FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Tenants can manage their maintenance services"
    ON public.maintenance_services
    FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Tenants can manage their preventive plans"
    ON public.preventive_plans
    FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()));

-- Habilitar a Extensão moddatetime caso não exista previamento no schema extensions
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- Criar Triggers para updated_at (assumindo que a function moddatetime já existe do 001)
CREATE TRIGGER handle_updated_at_maintenance_types BEFORE UPDATE ON public.maintenance_types FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime (updated_at);
CREATE TRIGGER handle_updated_at_maintenance_services BEFORE UPDATE ON public.maintenance_services FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime (updated_at);
CREATE TRIGGER handle_updated_at_preventive_plans BEFORE UPDATE ON public.preventive_plans FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime (updated_at);
