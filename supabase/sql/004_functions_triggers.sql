-- 004_functions_triggers.sql

-- ==========================================
-- UPDATE UPDATED_AT TIMESTAMP
-- ==========================================
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicando a trigger_updated_at em todas tabelas com coluna updated_at
DO $$ 
DECLARE 
  t_name text; 
BEGIN 
  FOR t_name IN 
    SELECT table_name FROM information_schema.columns 
    WHERE column_name = 'updated_at' AND table_schema = 'public'
  LOOP 
    EXECUTE format('CREATE TRIGGER trg_update_modified_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_modified_column();', t_name, t_name);
  END LOOP; 
END; 
$$;


-- ==========================================
-- AUTO CREATE USER PROFILE ON AUTH.USER
-- ==========================================
-- Quando um novo usuário for criado no auth.users (Supabase), cria automaticamente a linha em user_profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, must_change_password)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário ' || split_part(NEW.email, '@', 1)), true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- AUTO AUDIT LOG FUNCTION (exemplo simplificado)
-- ==========================================
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS trigger AS $$
DECLARE
    v_old JSONB := NULL;
    v_new JSONB := NULL;
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
    ELSIF (TG_OP = 'DELETE') THEN
        v_old := to_jsonb(OLD);
    ELSIF (TG_OP = 'INSERT') THEN
        v_new := to_jsonb(NEW);
    END IF;

    -- Em Supabase via HTTP RLS o JWT contains user id: auth.uid()
    -- Em chamadas pelo service role, pode não ter
    INSERT INTO public.audit_logs (
        user_id, action, module, entity, entity_id, old_data, new_data
    ) VALUES (
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
        TG_OP,
        TG_TABLE_SCHEMA,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        v_old,
        v_new
    );
    RETURN NULL; -- AFTER trigger
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar a trigger on importantes (exemplo apenas em work_orders)
CREATE TRIGGER trg_audit_work_orders
    AFTER INSERT OR UPDATE OR DELETE ON public.work_orders
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
