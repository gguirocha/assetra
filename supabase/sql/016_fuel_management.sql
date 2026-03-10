-- 016_fuel_management.sql
-- Módulo de Gestão de Abastecimentos

CREATE TABLE IF NOT EXISTS public.fuelings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    date TIMESTAMPTZ DEFAULT NOW(),
    station VARCHAR(200),
    fuel_type VARCHAR(50) DEFAULT 'diesel',
    liters NUMERIC(10, 2) NOT NULL DEFAULT 0,
    price_per_liter NUMERIC(10, 4) NOT NULL DEFAULT 0,
    total_cost NUMERIC(10, 2) GENERATED ALWAYS AS (liters * price_per_liter) STORED,
    odometer_km NUMERIC(12, 1) NOT NULL DEFAULT 0,
    previous_odometer_km NUMERIC(12, 1) DEFAULT 0,
    km_driven NUMERIC(12, 1) GENERATED ALWAYS AS (
        CASE WHEN previous_odometer_km > 0 AND odometer_km > previous_odometer_km
             THEN odometer_km - previous_odometer_km ELSE 0 END
    ) STORED,
    consumption_km_l NUMERIC(10, 2) GENERATED ALWAYS AS (
        CASE WHEN liters > 0 AND previous_odometer_km > 0 AND odometer_km > previous_odometer_km
             THEN (odometer_km - previous_odometer_km) / liters ELSE 0 END
    ) STORED,
    cost_per_km NUMERIC(10, 4) GENERATED ALWAYS AS (
        CASE WHEN previous_odometer_km > 0 AND odometer_km > previous_odometer_km AND (odometer_km - previous_odometer_km) > 0
             THEN (liters * price_per_liter) / (odometer_km - previous_odometer_km) ELSE 0 END
    ) STORED,
    is_full_tank BOOLEAN DEFAULT true,
    notes TEXT,
    alert_type VARCHAR(50),
    alert_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fuelings_tenant ON public.fuelings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fuelings_vehicle ON public.fuelings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuelings_date ON public.fuelings(date DESC);

-- RLS
ALTER TABLE public.fuelings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fuelings_select" ON public.fuelings FOR SELECT USING (true);
CREATE POLICY "fuelings_insert" ON public.fuelings FOR INSERT WITH CHECK (true);
CREATE POLICY "fuelings_update" ON public.fuelings FOR UPDATE USING (true);
CREATE POLICY "fuelings_delete" ON public.fuelings FOR DELETE USING (true);
