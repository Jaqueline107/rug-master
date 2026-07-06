
-- ========== PAYMENTS ==========
CREATE TABLE public.pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  costureira_id UUID NOT NULL REFERENCES public.costureiras(id) ON DELETE RESTRICT,
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  forma_pagamento TEXT NOT NULL DEFAULT 'pix',
  comprovante_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pagamento_remessas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id UUID NOT NULL REFERENCES public.pagamentos(id) ON DELETE CASCADE,
  remessa_id UUID NOT NULL REFERENCES public.remessas(id) ON DELETE RESTRICT,
  valor_pago NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.pagamento_remessas(pagamento_id);
CREATE INDEX ON public.pagamento_remessas(remessa_id);
CREATE INDEX ON public.pagamentos(costureira_id);

CREATE TRIGGER trg_pagamentos_updated_at BEFORE UPDATE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE VIEW public.remessas_a_pagar AS
SELECT
  r.id AS remessa_id,
  r.numero,
  r.costureira_id,
  r.data_envio,
  r.status,
  COALESCE(SUM(ri.quantidade_retornada * ri.preco_unitario), 0) AS valor_devido,
  COALESCE((SELECT SUM(valor_pago) FROM public.pagamento_remessas pr WHERE pr.remessa_id = r.id), 0) AS valor_ja_pago,
  COALESCE(SUM(ri.quantidade_retornada * ri.preco_unitario), 0)
    - COALESCE((SELECT SUM(valor_pago) FROM public.pagamento_remessas pr WHERE pr.remessa_id = r.id), 0) AS valor_pendente
FROM public.remessas r
LEFT JOIN public.remessa_itens ri ON ri.remessa_id = r.id
GROUP BY r.id, r.numero, r.costureira_id, r.data_envio, r.status;

-- ========== USERS / ROLES / PERMISSIONS ==========
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.app_resource AS ENUM (
  'dashboard','costureiras','tipos_tapete','modelos_tapetes',
  'insumos','servicos','precos','remessas','pagamentos','usuarios'
);
CREATE TYPE public.app_action AS ENUM ('view','create','update','delete');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.user_permissions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource public.app_resource NOT NULL,
  action public.app_action NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource, action)
);

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.can(_user_id UUID, _resource public.app_resource, _action public.app_action)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND resource = _resource AND action = _action)
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT COUNT(*) INTO v_count FROM public.user_roles;
  IF v_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos TO authenticated;
GRANT ALL ON public.pagamentos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamento_remessas TO authenticated;
GRANT ALL ON public.pagamento_remessas TO service_role;
GRANT SELECT ON public.remessas_a_pagar TO authenticated;
GRANT ALL ON public.remessas_a_pagar TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;

-- ENABLE RLS
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamento_remessas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing open policies
DO $$
DECLARE
  t TEXT;
  p TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['costureiras','tipos_tapete','tapetes','insumos','servicos','precos','remessas','remessa_itens','retornos','retorno_itens']) LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t);
    END LOOP;
  END LOOP;
END $$;

-- COSTUREIRAS
CREATE POLICY "costureiras_select" ON public.costureiras FOR SELECT TO authenticated USING (public.can(auth.uid(),'costureiras','view'));
CREATE POLICY "costureiras_insert" ON public.costureiras FOR INSERT TO authenticated WITH CHECK (public.can(auth.uid(),'costureiras','create'));
CREATE POLICY "costureiras_update" ON public.costureiras FOR UPDATE TO authenticated USING (public.can(auth.uid(),'costureiras','update')) WITH CHECK (public.can(auth.uid(),'costureiras','update'));
CREATE POLICY "costureiras_delete" ON public.costureiras FOR DELETE TO authenticated USING (public.can(auth.uid(),'costureiras','delete'));

CREATE POLICY "tipos_tapete_select" ON public.tipos_tapete FOR SELECT TO authenticated USING (public.can(auth.uid(),'tipos_tapete','view'));
CREATE POLICY "tipos_tapete_insert" ON public.tipos_tapete FOR INSERT TO authenticated WITH CHECK (public.can(auth.uid(),'tipos_tapete','create'));
CREATE POLICY "tipos_tapete_update" ON public.tipos_tapete FOR UPDATE TO authenticated USING (public.can(auth.uid(),'tipos_tapete','update')) WITH CHECK (public.can(auth.uid(),'tipos_tapete','update'));
CREATE POLICY "tipos_tapete_delete" ON public.tipos_tapete FOR DELETE TO authenticated USING (public.can(auth.uid(),'tipos_tapete','delete'));

CREATE POLICY "tapetes_select" ON public.tapetes FOR SELECT TO authenticated USING (public.can(auth.uid(),'modelos_tapetes','view'));
CREATE POLICY "tapetes_insert" ON public.tapetes FOR INSERT TO authenticated WITH CHECK (public.can(auth.uid(),'modelos_tapetes','create'));
CREATE POLICY "tapetes_update" ON public.tapetes FOR UPDATE TO authenticated USING (public.can(auth.uid(),'modelos_tapetes','update')) WITH CHECK (public.can(auth.uid(),'modelos_tapetes','update'));
CREATE POLICY "tapetes_delete" ON public.tapetes FOR DELETE TO authenticated USING (public.can(auth.uid(),'modelos_tapetes','delete'));

CREATE POLICY "insumos_select" ON public.insumos FOR SELECT TO authenticated USING (public.can(auth.uid(),'insumos','view'));
CREATE POLICY "insumos_insert" ON public.insumos FOR INSERT TO authenticated WITH CHECK (public.can(auth.uid(),'insumos','create'));
CREATE POLICY "insumos_update" ON public.insumos FOR UPDATE TO authenticated USING (public.can(auth.uid(),'insumos','update')) WITH CHECK (public.can(auth.uid(),'insumos','update'));
CREATE POLICY "insumos_delete" ON public.insumos FOR DELETE TO authenticated USING (public.can(auth.uid(),'insumos','delete'));

CREATE POLICY "servicos_select" ON public.servicos FOR SELECT TO authenticated USING (public.can(auth.uid(),'servicos','view'));
CREATE POLICY "servicos_insert" ON public.servicos FOR INSERT TO authenticated WITH CHECK (public.can(auth.uid(),'servicos','create'));
CREATE POLICY "servicos_update" ON public.servicos FOR UPDATE TO authenticated USING (public.can(auth.uid(),'servicos','update')) WITH CHECK (public.can(auth.uid(),'servicos','update'));
CREATE POLICY "servicos_delete" ON public.servicos FOR DELETE TO authenticated USING (public.can(auth.uid(),'servicos','delete'));

CREATE POLICY "precos_select" ON public.precos FOR SELECT TO authenticated USING (public.can(auth.uid(),'precos','view'));
CREATE POLICY "precos_insert" ON public.precos FOR INSERT TO authenticated WITH CHECK (public.can(auth.uid(),'precos','create'));
CREATE POLICY "precos_update" ON public.precos FOR UPDATE TO authenticated USING (public.can(auth.uid(),'precos','update')) WITH CHECK (public.can(auth.uid(),'precos','update'));
CREATE POLICY "precos_delete" ON public.precos FOR DELETE TO authenticated USING (public.can(auth.uid(),'precos','delete'));

CREATE POLICY "remessas_select" ON public.remessas FOR SELECT TO authenticated USING (public.can(auth.uid(),'remessas','view'));
CREATE POLICY "remessas_insert" ON public.remessas FOR INSERT TO authenticated WITH CHECK (public.can(auth.uid(),'remessas','create'));
CREATE POLICY "remessas_update" ON public.remessas FOR UPDATE TO authenticated USING (public.can(auth.uid(),'remessas','update')) WITH CHECK (public.can(auth.uid(),'remessas','update'));
CREATE POLICY "remessas_delete" ON public.remessas FOR DELETE TO authenticated USING (public.can(auth.uid(),'remessas','delete'));

CREATE POLICY "remessa_itens_select" ON public.remessa_itens FOR SELECT TO authenticated USING (public.can(auth.uid(),'remessas','view'));
CREATE POLICY "remessa_itens_insert" ON public.remessa_itens FOR INSERT TO authenticated WITH CHECK (public.can(auth.uid(),'remessas','create'));
CREATE POLICY "remessa_itens_update" ON public.remessa_itens FOR UPDATE TO authenticated USING (public.can(auth.uid(),'remessas','update')) WITH CHECK (public.can(auth.uid(),'remessas','update'));
CREATE POLICY "remessa_itens_delete" ON public.remessa_itens FOR DELETE TO authenticated USING (public.can(auth.uid(),'remessas','delete'));

CREATE POLICY "retornos_select" ON public.retornos FOR SELECT TO authenticated USING (public.can(auth.uid(),'remessas','view'));
CREATE POLICY "retornos_insert" ON public.retornos FOR INSERT TO authenticated WITH CHECK (public.can(auth.uid(),'remessas','update'));
CREATE POLICY "retornos_update" ON public.retornos FOR UPDATE TO authenticated USING (public.can(auth.uid(),'remessas','update')) WITH CHECK (public.can(auth.uid(),'remessas','update'));
CREATE POLICY "retornos_delete" ON public.retornos FOR DELETE TO authenticated USING (public.can(auth.uid(),'remessas','delete'));

CREATE POLICY "retorno_itens_select" ON public.retorno_itens FOR SELECT TO authenticated USING (public.can(auth.uid(),'remessas','view'));
CREATE POLICY "retorno_itens_insert" ON public.retorno_itens FOR INSERT TO authenticated WITH CHECK (public.can(auth.uid(),'remessas','update'));
CREATE POLICY "retorno_itens_update" ON public.retorno_itens FOR UPDATE TO authenticated USING (public.can(auth.uid(),'remessas','update')) WITH CHECK (public.can(auth.uid(),'remessas','update'));
CREATE POLICY "retorno_itens_delete" ON public.retorno_itens FOR DELETE TO authenticated USING (public.can(auth.uid(),'remessas','delete'));

CREATE POLICY "pagamentos_select" ON public.pagamentos FOR SELECT TO authenticated USING (public.can(auth.uid(),'pagamentos','view'));
CREATE POLICY "pagamentos_insert" ON public.pagamentos FOR INSERT TO authenticated WITH CHECK (public.can(auth.uid(),'pagamentos','create'));
CREATE POLICY "pagamentos_update" ON public.pagamentos FOR UPDATE TO authenticated USING (public.can(auth.uid(),'pagamentos','update')) WITH CHECK (public.can(auth.uid(),'pagamentos','update'));
CREATE POLICY "pagamentos_delete" ON public.pagamentos FOR DELETE TO authenticated USING (public.can(auth.uid(),'pagamentos','delete'));

CREATE POLICY "pagamento_remessas_select" ON public.pagamento_remessas FOR SELECT TO authenticated USING (public.can(auth.uid(),'pagamentos','view'));
CREATE POLICY "pagamento_remessas_insert" ON public.pagamento_remessas FOR INSERT TO authenticated WITH CHECK (public.can(auth.uid(),'pagamentos','create'));
CREATE POLICY "pagamento_remessas_update" ON public.pagamento_remessas FOR UPDATE TO authenticated USING (public.can(auth.uid(),'pagamentos','update')) WITH CHECK (public.can(auth.uid(),'pagamentos','update'));
CREATE POLICY "pagamento_remessas_delete" ON public.pagamento_remessas FOR DELETE TO authenticated USING (public.can(auth.uid(),'pagamentos','delete'));

CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "user_roles_self_select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "user_permissions_self_select" ON public.user_permissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_permissions_admin_all" ON public.user_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
