
-- Single-user app: permissive policies on anon (no auth)
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- COSTUREIRAS
CREATE TABLE public.costureiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  endereco TEXT,
  observacoes TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.costureiras TO anon, authenticated;
GRANT ALL ON public.costureiras TO service_role;
ALTER TABLE public.costureiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open" ON public.costureiras FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER t_upd BEFORE UPDATE ON public.costureiras FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TIPOS DE TAPETE
CREATE TABLE public.tipos_tapete (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  numero_pecas INTEGER NOT NULL DEFAULT 1,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_tapete TO anon, authenticated;
GRANT ALL ON public.tipos_tapete TO service_role;
ALTER TABLE public.tipos_tapete ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open" ON public.tipos_tapete FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER t_upd BEFORE UPDATE ON public.tipos_tapete FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TAPETES
CREATE TABLE public.tapetes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT,
  nome TEXT NOT NULL,
  tipo_tapete_id UUID NOT NULL REFERENCES public.tipos_tapete(id) ON DELETE RESTRICT,
  cor TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tapetes TO anon, authenticated;
GRANT ALL ON public.tapetes TO service_role;
ALTER TABLE public.tapetes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open" ON public.tapetes FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER t_upd BEFORE UPDATE ON public.tapetes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- INSUMOS
CREATE TABLE public.insumos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'un',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insumos TO anon, authenticated;
GRANT ALL ON public.insumos TO service_role;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open" ON public.insumos FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER t_upd BEFORE UPDATE ON public.insumos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SERVICOS
CREATE TABLE public.servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  insumo_id UUID REFERENCES public.insumos(id) ON DELETE SET NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servicos TO anon, authenticated;
GRANT ALL ON public.servicos TO service_role;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open" ON public.servicos FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER t_upd BEFORE UPDATE ON public.servicos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PRECOS: costureira + servico + tipo_tapete -> valor
CREATE TABLE public.precos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  costureira_id UUID NOT NULL REFERENCES public.costureiras(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
  tipo_tapete_id UUID NOT NULL REFERENCES public.tipos_tapete(id) ON DELETE CASCADE,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(costureira_id, servico_id, tipo_tapete_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.precos TO anon, authenticated;
GRANT ALL ON public.precos TO service_role;
ALTER TABLE public.precos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open" ON public.precos FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER t_upd BEFORE UPDATE ON public.precos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- REMESSAS
CREATE TABLE public.remessas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero SERIAL,
  costureira_id UUID NOT NULL REFERENCES public.costureiras(id) ON DELETE RESTRICT,
  data_envio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prevista_retorno DATE,
  status TEXT NOT NULL DEFAULT 'aberta',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remessas TO anon, authenticated;
GRANT ALL ON public.remessas TO service_role;
ALTER TABLE public.remessas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open" ON public.remessas FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER t_upd BEFORE UPDATE ON public.remessas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- REMESSA ITENS
CREATE TABLE public.remessa_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  remessa_id UUID NOT NULL REFERENCES public.remessas(id) ON DELETE CASCADE,
  tapete_id UUID NOT NULL REFERENCES public.tapetes(id) ON DELETE RESTRICT,
  servico_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE RESTRICT,
  quantidade_enviada INTEGER NOT NULL DEFAULT 1,
  quantidade_retornada INTEGER NOT NULL DEFAULT 0,
  preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remessa_itens TO anon, authenticated;
GRANT ALL ON public.remessa_itens TO service_role;
ALTER TABLE public.remessa_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open" ON public.remessa_itens FOR ALL USING (true) WITH CHECK (true);

-- RETORNOS
CREATE TABLE public.retornos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  remessa_id UUID NOT NULL REFERENCES public.remessas(id) ON DELETE CASCADE,
  data_retorno DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retornos TO anon, authenticated;
GRANT ALL ON public.retornos TO service_role;
ALTER TABLE public.retornos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open" ON public.retornos FOR ALL USING (true) WITH CHECK (true);

-- RETORNO ITENS
CREATE TABLE public.retorno_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  retorno_id UUID NOT NULL REFERENCES public.retornos(id) ON DELETE CASCADE,
  remessa_item_id UUID NOT NULL REFERENCES public.remessa_itens(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retorno_itens TO anon, authenticated;
GRANT ALL ON public.retorno_itens TO service_role;
ALTER TABLE public.retorno_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open" ON public.retorno_itens FOR ALL USING (true) WITH CHECK (true);

-- Trigger: when retorno_itens insert/update/delete -> recalculate remessa_itens.quantidade_retornada and remessa.status
CREATE OR REPLACE FUNCTION public.recalcular_remessa() RETURNS TRIGGER AS $$
DECLARE
  v_remessa_item_id UUID;
  v_remessa_id UUID;
  v_total_enviado INTEGER;
  v_total_retornado INTEGER;
BEGIN
  v_remessa_item_id := COALESCE(NEW.remessa_item_id, OLD.remessa_item_id);
  -- recalcula quantidade_retornada do item
  UPDATE public.remessa_itens ri
  SET quantidade_retornada = COALESCE((SELECT SUM(quantidade) FROM public.retorno_itens WHERE remessa_item_id = ri.id), 0)
  WHERE ri.id = v_remessa_item_id
  RETURNING remessa_id INTO v_remessa_id;

  -- recalcula status da remessa
  SELECT SUM(quantidade_enviada), SUM(quantidade_retornada) INTO v_total_enviado, v_total_retornado
  FROM public.remessa_itens WHERE remessa_id = v_remessa_id;

  UPDATE public.remessas SET status = CASE
    WHEN COALESCE(v_total_retornado,0) = 0 THEN 'aberta'
    WHEN v_total_retornado >= v_total_enviado THEN 'concluida'
    ELSE 'parcial'
  END
  WHERE id = v_remessa_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_retorno_itens_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.retorno_itens
FOR EACH ROW EXECUTE FUNCTION public.recalcular_remessa();
