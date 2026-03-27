-- 020_technician_service_types.sql
-- Add service_types to maintenance_technicians and user_profiles

-- 1. Add service_types to maintenance_technicians (array of: vehicle, machine, facility)
ALTER TABLE public.maintenance_technicians 
ADD COLUMN IF NOT EXISTS service_types TEXT[] DEFAULT '{vehicle,machine,facility}';

-- 2. Add technician flags to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS is_technician BOOLEAN DEFAULT false;

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS technician_service_types TEXT[] DEFAULT '{}';
