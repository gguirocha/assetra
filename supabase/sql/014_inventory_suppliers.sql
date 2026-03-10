-- 014_inventory_suppliers.sql
-- Tabela de fornecedores e melhorias no estoque

-- 1. Tabela de Fornecedores
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20),
    contact_name VARCHAR(150),
    phone VARCHAR(30),
    email VARCHAR(150),
    address TEXT,
    category VARCHAR(100), -- Peças, Serviços, Combustível, etc.
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Codprod auto-incremento a partir de 1
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'parts_codprod_seq') THEN
        CREATE SEQUENCE public.parts_codprod_seq START WITH 1 INCREMENT BY 1;
    END IF;
END $$;
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS codprod INT DEFAULT nextval('public.parts_codprod_seq');
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- 3. Adicionar tenant_id à stock_movements (para RLS)
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p_suppliers_all" ON public.suppliers;
CREATE POLICY p_suppliers_all ON public.suppliers FOR ALL USING (tenant_id = get_auth_tenant_id() OR is_global_admin());

DROP POLICY IF EXISTS "p_parts_all" ON public.parts;
CREATE POLICY p_parts_all ON public.parts FOR ALL USING (tenant_id = get_auth_tenant_id() OR is_global_admin());

DROP POLICY IF EXISTS "p_stock_movements_all" ON public.stock_movements;
CREATE POLICY p_stock_movements_all ON public.stock_movements FOR ALL USING (tenant_id = get_auth_tenant_id() OR is_global_admin());

-- Índices
CREATE INDEX IF NOT EXISTS idx_parts_sku ON public.parts(sku);
CREATE INDEX IF NOT EXISTS idx_parts_codprod ON public.parts(codprod);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);
CREATE INDEX IF NOT EXISTS idx_stock_movements_part ON public.stock_movements(part_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON public.stock_movements(date);

-- Trigger updated_at
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
DROP TRIGGER IF EXISTS handle_updated_at_suppliers ON public.suppliers;
CREATE TRIGGER handle_updated_at_suppliers BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime (updated_at);
