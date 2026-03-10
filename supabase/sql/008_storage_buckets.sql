-- 008_storage_buckets.sql
-- Create storage buckets for the application

-- Habilita a extensão do Storage caso não esteja
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cria o bucket se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('fleet-documents', 'fleet-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de RLS para o Bucket "fleet-documents"
-- Permitir que usuários autenticados façam upload
CREATE POLICY "Allow authenticated uploads to fleet-documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'fleet-documents' );

-- Permitir que usuários leiam os arquivos (simplificado: acesso global autenticado para demonstração)
-- Numa versão mais restrita, o path poderia incluir o tenant_id.
CREATE POLICY "Allow authenticated reads from fleet-documents"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'fleet-documents' );

-- Permitir exclusão de arquivos
CREATE POLICY "Allow authenticated deletes from fleet-documents"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'fleet-documents' );
