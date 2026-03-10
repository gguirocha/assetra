-- 015_stock_reservation.sql
-- Sistema de reserva de estoque para OS

-- 1. Estoque reservado na tabela de peças
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS reserved_stock NUMERIC(10, 2) DEFAULT 0;

-- 2. Status nos itens da OS (reservado → baixado | cancelado)
ALTER TABLE public.work_order_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'reservado';
-- valores: reservado, baixado, cancelado

-- 3. Índice
CREATE INDEX IF NOT EXISTS idx_woi_status ON public.work_order_items(status);
