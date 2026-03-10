-- ============================================================
-- SCRIPT 3: LIMPAR DADOS FAKE (PARA USO FUTURO)
-- Use este script quando quiser remover os dados de demonstração
-- e começar a usar o sistema com dados reais.
-- ============================================================

-- Este script é idêntico ao seed_01_cleanup.sql
-- Ele remove TODOS os dados das tabelas operacionais.
-- NÃO remove: tenants, user_profiles, roles, permissions, user_roles

-- Ordem reversa de dependências
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

-- Reset sequences se existirem
-- ALTER SEQUENCE public.parts_codprod_seq RESTART WITH 1;

SELECT '✅ Todos os dados fake foram removidos! O sistema está limpo para dados reais.' AS resultado;
