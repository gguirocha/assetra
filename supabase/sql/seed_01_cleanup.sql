-- ============================================================
-- SCRIPT 1: LIMPAR TODOS OS DADOS DE TESTE EXISTENTES
-- Execute ANTES de inserir os dados fake
-- ============================================================

-- Ordem reversa de dependências (filhos primeiro)
DELETE FROM public.work_order_items;
DELETE FROM public.stock_movements;
DELETE FROM public.fuelings;
DELETE FROM public.car_wash_schedules;
DELETE FROM public.car_wash_rules;
DELETE FROM public.work_orders;
DELETE FROM public.preventive_plans;
DELETE FROM public.maintenance_services;
DELETE FROM public.maintenance_types;
DELETE FROM public.fines;
DELETE FROM public.tachograph_checks;
DELETE FROM public.insurances;
DELETE FROM public.warranties;
DELETE FROM public.vehicle_documents;
DELETE FROM public.driver_documents;
DELETE FROM public.extinguishers;
DELETE FROM public.parts;
DELETE FROM public.suppliers;
DELETE FROM public.fuel_logs;
DELETE FROM public.calendar_events;
DELETE FROM public.notifications;
DELETE FROM public.vehicles;
DELETE FROM public.drivers;
DELETE FROM public.assets_machines;
DELETE FROM public.assets_facilities;
DELETE FROM public.maintenance_technicians;

SELECT 'Todos os dados de teste foram removidos com sucesso!' AS resultado;
