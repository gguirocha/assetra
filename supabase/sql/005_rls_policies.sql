-- 005_rls_policies.sql

-- Habilitar RLS em todas as tabelas
DO $$ 
DECLARE 
  t_name text; 
BEGIN 
  FOR t_name IN 
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP 
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t_name);
  END LOOP; 
END; 
$$;

-- Nota: Como service_role desvia do RLS por padrão, esta segurança protege APIs anônimas ou com auth JWT válido.

-- ==========================================
-- POLICIES COMUNS: Baseadas em Tenant
-- ==========================================

-- A ideia é permitir acesso apenas se o tenant do recurso bater com o tenant do profile logado
-- OU se for um super ADMIN global

-- Função auxiliar genérica para pegar tenant atual do user logado
CREATE OR REPLACE FUNCTION get_auth_tenant_id() RETURNS UUID AS $$
  SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Função auxiliar para checar se é admin global (bypassa tenant)
CREATE OR REPLACE FUNCTION is_global_admin() RETURNS BOOLEAN AS $$
  SELECT is_admin FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- 1. Tenant: Read-only para users
CREATE POLICY p_tenants_select ON public.tenants FOR SELECT USING (id = get_auth_tenant_id() OR is_global_admin());

-- 2. Profiles: Permite ler do mesmo tenant
CREATE POLICY p_profiles_select ON public.user_profiles FOR SELECT USING (tenant_id = get_auth_tenant_id() OR is_global_admin());
CREATE POLICY p_profiles_update_self ON public.user_profiles FOR UPDATE USING (id = auth.uid() OR is_global_admin());

-- 3. Vehicles
CREATE POLICY p_vehicles_all ON public.vehicles FOR ALL USING (tenant_id = get_auth_tenant_id() OR is_global_admin());

-- 4. Drivers
CREATE POLICY p_drivers_all ON public.drivers FOR ALL USING (tenant_id = get_auth_tenant_id() OR is_global_admin());

-- 5. Outras tabelas com tenant_id
CREATE POLICY p_assets_machines_all ON public.assets_machines FOR ALL USING (tenant_id = get_auth_tenant_id() OR is_global_admin());
CREATE POLICY p_assets_facilities_all ON public.assets_facilities FOR ALL USING (tenant_id = get_auth_tenant_id() OR is_global_admin());
CREATE POLICY p_extinguishers_all ON public.extinguishers FOR ALL USING (tenant_id = get_auth_tenant_id() OR is_global_admin());

CREATE POLICY p_work_orders_all ON public.work_orders FOR ALL USING (tenant_id = get_auth_tenant_id() OR is_global_admin());
CREATE POLICY p_parts_all ON public.parts FOR ALL USING (tenant_id = get_auth_tenant_id() OR is_global_admin());

CREATE POLICY p_fuel_logs_all ON public.fuel_logs FOR ALL USING (tenant_id = get_auth_tenant_id() OR is_global_admin());
CREATE POLICY p_car_wash_schedules_all ON public.car_wash_schedules FOR ALL USING (tenant_id = get_auth_tenant_id() OR is_global_admin());
CREATE POLICY p_calendar_events_all ON public.calendar_events FOR ALL USING (tenant_id = get_auth_tenant_id() OR is_global_admin());
CREATE POLICY p_automation_rules_all ON public.automation_rules FOR ALL USING (tenant_id = get_auth_tenant_id() OR is_global_admin());

-- Notifications
CREATE POLICY p_notifications_user_only ON public.notifications FOR SELECT USING (user_id = auth.uid() OR is_global_admin());
CREATE POLICY p_notifications_update_user_only ON public.notifications FOR UPDATE USING (user_id = auth.uid() OR is_global_admin());

-- O restante das tabelas associativas (fines, documents, work_order_items, stock_movements)
-- herdam indiretamente ou precisam de subquery (ex: vehicle documents)

CREATE POLICY p_vehicle_documents_all ON public.vehicle_documents FOR ALL USING (
  EXISTS(SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND (v.tenant_id = get_auth_tenant_id() OR is_global_admin()))
);

CREATE POLICY p_driver_documents_all ON public.driver_documents FOR ALL USING (
  EXISTS(SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND (d.tenant_id = get_auth_tenant_id() OR is_global_admin()))
);

CREATE POLICY p_fines_all ON public.fines FOR ALL USING (
  EXISTS(SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND (v.tenant_id = get_auth_tenant_id() OR is_global_admin()))
);
CREATE POLICY p_tachograph_checks_all ON public.tachograph_checks FOR ALL USING (
  EXISTS(SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND (v.tenant_id = get_auth_tenant_id() OR is_global_admin()))
);
CREATE POLICY p_insurances_all ON public.insurances FOR ALL USING (
  EXISTS(SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND (v.tenant_id = get_auth_tenant_id() OR is_global_admin()))
);
CREATE POLICY p_warranties_all ON public.warranties FOR ALL USING (
  EXISTS(SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND (v.tenant_id = get_auth_tenant_id() OR is_global_admin()))
);

CREATE POLICY p_stock_movements_all ON public.stock_movements FOR ALL USING (
  EXISTS(SELECT 1 FROM public.parts p WHERE p.id = part_id AND (p.tenant_id = get_auth_tenant_id() OR is_global_admin()))
);

CREATE POLICY p_work_order_items_all ON public.work_order_items FOR ALL USING (
    EXISTS(SELECT 1 FROM public.work_orders w WHERE w.id = work_order_id AND (w.tenant_id = get_auth_tenant_id() OR is_global_admin()))
);

-- Audit logs
CREATE POLICY p_audit_logs_read ON public.audit_logs FOR SELECT USING (tenant_id = get_auth_tenant_id() OR is_global_admin());
-- Insert by service role only, or triggers bypass RLS.
