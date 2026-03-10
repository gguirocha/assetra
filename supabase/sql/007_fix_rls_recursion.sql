-- 007_fix_rls_recursion.sql
-- Este script corrige o problema de "Infinite Recursion" ao rodar RLS complexos,
-- alterando de funções LANGUAGE sql (que sofrem in-lining pelo Postgres)
-- para LANGUAGE plpgsql protegidas com SECURITY DEFINER explícito.

CREATE OR REPLACE FUNCTION get_auth_tenant_id() RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_global_admin() RETURNS BOOLEAN AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
  RETURN COALESCE(v_is_admin, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
