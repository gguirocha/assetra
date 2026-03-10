-- 010_fix_missing_schemas_and_rls.sql

-- 1. FIX RLS POLICIES FOR MAINTENANCE CATALOGS
-- This replaces the restrictive policies with ones that allow global admins

DROP POLICY IF EXISTS "Tenants can manage their maintenance types" ON public.maintenance_types;
CREATE POLICY p_maintenance_types_all ON public.maintenance_types
    FOR ALL
    USING (tenant_id = get_auth_tenant_id() OR is_global_admin());

DROP POLICY IF EXISTS "Tenants can manage their maintenance services" ON public.maintenance_services;
CREATE POLICY p_maintenance_services_all ON public.maintenance_services
    FOR ALL
    USING (tenant_id = get_auth_tenant_id() OR is_global_admin());

DROP POLICY IF EXISTS "Tenants can manage their preventive plans" ON public.preventive_plans;
CREATE POLICY p_preventive_plans_all ON public.preventive_plans
    FOR ALL
    USING (tenant_id = get_auth_tenant_id() OR is_global_admin());

-- 2. ALTER DRIVERS TABLE TO INCLUDE MISSING COLUMNS
-- This adds the columns that the frontend expects in the 'drivers' form

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS rg VARCHAR(30),
ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
ADD COLUMN IF NOT EXISTS email VARCHAR(150),
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ativo';

-- Note: The frontend uses 'status' as 'ativo', 'inativo', 'ferias', 'afastado'. 
-- We'll keep the existing 'active' boolean for backward compatibility, but 'status' will be the source of truth for the UI.
