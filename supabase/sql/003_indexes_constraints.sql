-- 003_indexes_constraints.sql

-- Tenants
CREATE INDEX IF NOT EXISTS idx_tenants_active ON public.tenants(active);

-- User Profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant ON public.user_profiles(tenant_id);

-- Fleet
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON public.vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_exp ON public.vehicle_documents(expiration_date);

CREATE INDEX IF NOT EXISTS idx_drivers_tenant ON public.drivers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_driver_documents_exp ON public.driver_documents(expiration_date);

-- Fines & Insurances
CREATE INDEX IF NOT EXISTS idx_fines_status ON public.fines(status);
CREATE INDEX IF NOT EXISTS idx_insurances_end_date ON public.insurances(end_date);

-- Facilities & Machines
CREATE INDEX IF NOT EXISTS idx_assets_machines_tenant ON public.assets_machines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assets_facilities_tenant ON public.assets_facilities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_extinguishers_recharge ON public.extinguishers(recharge_expiration);

-- Work Orders
CREATE INDEX IF NOT EXISTS idx_work_orders_tenant ON public.work_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON public.work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_vehicle ON public.work_orders(vehicle_id);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_parts_tenant ON public.parts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parts_sku ON public.parts(sku);

-- Fuel & Wash
CREATE INDEX IF NOT EXISTS idx_fuel_logs_tenant ON public.fuel_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle_date ON public.fuel_logs(vehicle_id, date);
CREATE INDEX IF NOT EXISTS idx_car_wash_date ON public.car_wash_schedules(scheduled_date);

-- Calendar & Notifications
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON public.calendar_events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);
