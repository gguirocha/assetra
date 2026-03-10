-- 010_preventive_plans_alter.sql

-- Adicionar colunas de referência para máquinas e facilities na tabela de planos preventivos
ALTER TABLE public.preventive_plans 
ADD COLUMN IF NOT EXISTS machine_id UUID REFERENCES public.assets_machines(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.assets_facilities(id) ON DELETE CASCADE;
