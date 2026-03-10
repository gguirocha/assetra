-- 006_seed_admin_and_roles.sql

-- Inserir as Roles Padrões
INSERT INTO public.roles (name, description) VALUES
('ADMIN', 'Acesso total a todos os módulos e configurações'),
('MANUTENCAO', 'Equipe de mecânica e técnica de veículos'),
('FACILITIES', 'Equipe de manutenção predial e máquinas'),
('ESTOQUE', 'Gestão de peças, compras e suprimentos'),
('GESTOR', 'Gestor logístico/frotas (relatórios, dashboard)'),
('MOTORISTA', 'Acesso limitado ao app para abrir OS ou ver agenda'),
('SOLICITANTE', 'Acesso básico para abrir ticket de OS e ver status')
ON CONFLICT (name) DO NOTHING;

-- Inserir uma Entidade "Empresa Local" para fallback no start
INSERT INTO public.tenants (id, name, active) 
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Local Company Defaults', true)
ON CONFLICT DO NOTHING;

-- Inserir Regras base de Automação (Seed)
INSERT INTO public.automation_rules (tenant_id, name, event, conditions, actions, frequency, active) VALUES
('00000000-0000-0000-0000-000000000001'::uuid, 'Aviso Documentos Vencendo 15d', 'document_expiration', '{"days_before": 15}', '{"type": "email", "target_role": "GESTOR"}', 'daily', true),
('00000000-0000-0000-0000-000000000001'::uuid, 'OS Atrasada (SLA Estourou)', 'work_order_sla', '{"status": "aberta", "overdue": true}', '{"type": "notification", "target_role": "ADMIN"}', '15min', true),
('00000000-0000-0000-0000-000000000001'::uuid, 'Estoque Baixo Alarm', 'stock_low', '{"below_min": true}', '{"type": "email", "target_role": "ESTOQUE"}', 'daily', true)
ON CONFLICT DO NOTHING;

-- OBS:
-- O Usuário Admin (auth.users) não pode ser inserido facilmente via plain SQL puro a menos que seja feita uma hash da senha compatível com o gotrue. 
-- Portanto, a inserção do primeiro ADMIN local será feita VIA API, usando Supabase Admin Auth API na rota `/admin/bootstrap`.
