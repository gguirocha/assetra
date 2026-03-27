-- 017_user_portal.sql
-- Tabelas adicionais para o Portal do Usuário

-- 1. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    user_name VARCHAR(255),
    action VARCHAR(50) NOT NULL, -- create, update, delete, login, logout
    module VARCHAR(50) NOT NULL, -- fleet, maintenance, inventory, etc.
    entity VARCHAR(100), -- vehicles, work_orders, etc.
    entity_id UUID,
    before_data JSONB,
    after_data JSONB,
    ip_address VARCHAR(50),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. System Settings (chave-valor por tenant)
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- smtp, sla, general, notifications
    key VARCHAR(100) NOT NULL,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, category, key)
);

-- 3. Adicionar unidade e email ao user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS unit VARCHAR(100);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 4. RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_audit_logs_all ON public.audit_logs;
CREATE POLICY p_audit_logs_all ON public.audit_logs FOR ALL
USING (tenant_id = get_auth_tenant_id() OR is_global_admin());

DROP POLICY IF EXISTS p_system_settings_all ON public.system_settings;
CREATE POLICY p_system_settings_all ON public.system_settings FOR ALL
USING (tenant_id = get_auth_tenant_id() OR is_global_admin());

-- 4b. RLS para roles, permissions e role_permissions (tabelas globais sem tenant_id)
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Roles: leitura para todos autenticados, escrita para todos (controle no app)
DROP POLICY IF EXISTS p_roles_select ON public.roles;
CREATE POLICY p_roles_select ON public.roles FOR SELECT USING (true);
DROP POLICY IF EXISTS p_roles_insert ON public.roles;
CREATE POLICY p_roles_insert ON public.roles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS p_roles_update ON public.roles;
CREATE POLICY p_roles_update ON public.roles FOR UPDATE USING (true);
DROP POLICY IF EXISTS p_roles_delete ON public.roles;
CREATE POLICY p_roles_delete ON public.roles FOR DELETE USING (true);

-- Permissions: leitura para todos autenticados, escrita para todos
DROP POLICY IF EXISTS p_permissions_select ON public.permissions;
CREATE POLICY p_permissions_select ON public.permissions FOR SELECT USING (true);
DROP POLICY IF EXISTS p_permissions_insert ON public.permissions;
CREATE POLICY p_permissions_insert ON public.permissions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS p_permissions_update ON public.permissions;
CREATE POLICY p_permissions_update ON public.permissions FOR UPDATE USING (true);
DROP POLICY IF EXISTS p_permissions_delete ON public.permissions;
CREATE POLICY p_permissions_delete ON public.permissions FOR DELETE USING (true);

-- Role_permissions: acesso total para autenticados
DROP POLICY IF EXISTS p_role_permissions_select ON public.role_permissions;
CREATE POLICY p_role_permissions_select ON public.role_permissions FOR SELECT USING (true);
DROP POLICY IF EXISTS p_role_permissions_insert ON public.role_permissions;
CREATE POLICY p_role_permissions_insert ON public.role_permissions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS p_role_permissions_delete ON public.role_permissions;
CREATE POLICY p_role_permissions_delete ON public.role_permissions FOR DELETE USING (true);

-- User_roles: acesso total para autenticados
DROP POLICY IF EXISTS p_user_roles_select ON public.user_roles;
CREATE POLICY p_user_roles_select ON public.user_roles FOR SELECT USING (true);
DROP POLICY IF EXISTS p_user_roles_insert ON public.user_roles;
CREATE POLICY p_user_roles_insert ON public.user_roles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS p_user_roles_delete ON public.user_roles;
CREATE POLICY p_user_roles_delete ON public.user_roles FOR DELETE USING (true);

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_settings_tenant ON public.system_settings(tenant_id, category);

-- 6. Seed de Roles padrão
INSERT INTO public.roles (name, description) VALUES
('ADMIN', 'Administrador com acesso total ao sistema'),
('GESTOR_FROTA', 'Gestor de Frota - veículos, motoristas, documentos'),
('GESTOR_MANUTENCAO', 'Gestor de Manutenção - OS, preventivas, técnicos'),
('TECNICO', 'Técnico de Manutenção - executa OS'),
('GESTOR_ESTOQUE', 'Gestor de Estoque - peças, fornecedores'),
('GESTOR_ABASTECIMENTO', 'Gestor de Abastecimento'),
('VISUALIZADOR', 'Apenas visualização - sem permissão de edição')
ON CONFLICT (name) DO NOTHING;

-- 7. Seed de Permissões (módulo.entidade.ação)
INSERT INTO public.permissions (action, module, description) VALUES
-- Frota
('fleet.vehicles.read', 'fleet', 'Visualizar veículos'),
('fleet.vehicles.write', 'fleet', 'Criar/editar veículos'),
('fleet.vehicles.delete', 'fleet', 'Excluir veículos'),
('fleet.drivers.read', 'fleet', 'Visualizar motoristas'),
('fleet.drivers.write', 'fleet', 'Criar/editar motoristas'),
('fleet.documents.read', 'fleet', 'Visualizar documentos'),
('fleet.documents.write', 'fleet', 'Criar/editar documentos'),
-- Manutenção
('maintenance.orders.read', 'maintenance', 'Visualizar OS'),
('maintenance.orders.write', 'maintenance', 'Criar/editar OS'),
('maintenance.orders.delete', 'maintenance', 'Excluir OS'),
('maintenance.preventive.read', 'maintenance', 'Visualizar planos preventivos'),
('maintenance.preventive.write', 'maintenance', 'Criar/editar planos preventivos'),
('maintenance.team.read', 'maintenance', 'Visualizar equipe'),
('maintenance.team.write', 'maintenance', 'Gerenciar equipe'),
-- Estoque
('inventory.parts.read', 'inventory', 'Visualizar estoque'),
('inventory.parts.write', 'inventory', 'Criar/editar peças'),
('inventory.movements.read', 'inventory', 'Visualizar movimentações'),
('inventory.movements.write', 'inventory', 'Registrar movimentações'),
-- Abastecimento
('fuel.records.read', 'fuel', 'Visualizar abastecimentos'),
('fuel.records.write', 'fuel', 'Registrar abastecimentos'),
-- Lava-jato
('carwash.schedules.read', 'carwash', 'Visualizar lavagens'),
('carwash.schedules.write', 'carwash', 'Agendar lavagens'),
-- Admin
('admin.users.read', 'admin', 'Visualizar usuários'),
('admin.users.write', 'admin', 'Gerenciar usuários'),
('admin.roles.read', 'admin', 'Visualizar roles'),
('admin.roles.write', 'admin', 'Gerenciar roles/permissões'),
('admin.settings.read', 'admin', 'Visualizar configurações'),
('admin.settings.write', 'admin', 'Editar configurações'),
('admin.audit.read', 'admin', 'Visualizar logs de auditoria'),
('admin.automations.read', 'admin', 'Visualizar automações'),
('admin.automations.write', 'admin', 'Gerenciar automações'),
-- Ordens de Serviço (módulo unificado)
('work_orders.orders.read', 'work_orders', 'Visualizar Ordens de Serviço'),
('work_orders.orders.write', 'work_orders', 'Criar/editar Ordens de Serviço'),
('work_orders.orders.delete', 'work_orders', 'Excluir Ordens de Serviço'),
('work_orders.technician.read', 'work_orders', 'Acessar Portal do Técnico'),
('work_orders.requester.read', 'work_orders', 'Acessar Portal do Solicitante'),
('work_orders.orders.interact', 'work_orders', 'Interagir com OS (comentários, status)')
ON CONFLICT (action) DO NOTHING;

-- 8. Seed de automações padrão
INSERT INTO public.automation_rules (tenant_id, name, event, conditions, actions, frequency, active) 
SELECT t.id, v.name, v.event, v.conditions::jsonb, v.actions::jsonb, v.freq, true
FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES
  ('Alerta CNH vencendo em 30 dias','cnh_expiring','{"days_before": 30}'::text,'[{"type": "notification", "title": "CNH vencendo", "message": "A CNH do motorista {driver_name} vence em {days} dias"}]'::text,'daily'),
  ('Alerta Documento veículo vencendo','document_expiring','{"days_before": 30}'::text,'[{"type": "notification", "title": "Documento vencendo", "message": "{doc_type} do veículo {plate} vence em {days} dias"}]'::text,'daily'),
  ('Alerta Estoque baixo','low_stock','{"threshold": "min_stock"}'::text,'[{"type": "notification", "title": "Estoque baixo", "message": "O item {part_name} está com estoque abaixo do mínimo ({current}/{min})"}]'::text,'daily'),
  ('OS atrasada (SLA)','os_sla_exceeded','{"hours_exceeded": 0}'::text,'[{"type": "notification", "title": "OS atrasada", "message": "A OS #{wo_id} excedeu o SLA em {hours}h"}]'::text,'hourly'),
  ('Manutenção preventiva próxima','preventive_due','{"days_before": 7}'::text,'[{"type": "notification", "title": "Preventiva próxima", "message": "Manutenção preventiva de {asset_name} programada para {date}"}, {"type": "calendar_event"}]'::text,'daily'),
  ('Lavagem atrasada','wash_overdue','{"days_overdue": 0}'::text,'[{"type": "notification", "title": "Lavagem atrasada", "message": "O veículo {plate} está com lavagem atrasada há {days} dias"}]'::text,'daily'),
  ('Exame periódico vencendo','exam_expiring','{"days_before": 30}'::text,'[{"type": "notification", "title": "Exame vencendo", "message": "O exame {exam_type} do motorista {driver_name} vence em {days} dias"}]'::text,'daily'),
  ('Seguro vencendo','insurance_expiring','{"days_before": 30}'::text,'[{"type": "notification", "title": "Seguro vencendo", "message": "O seguro do veículo {plate} vence em {days} dias"}, {"type": "email"}]'::text,'daily')
) AS v(name, event, conditions, actions, freq);
