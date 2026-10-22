BEGIN;

CREATE TABLE IF NOT EXISTS public.pagamentos (
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
CREATE TABLE IF NOT EXISTS public.pagamento_remessas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id UUID NOT NULL REFERENCES public.pagamentos(id) ON DELETE CASCADE,
  remessa_id UUID NOT NULL REFERENCES public.remessas(id) ON DELETE RESTRICT,
  valor_pago NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pagamento_remessas_pagamento_idx ON public.pagamento_remessas(pagamento_id);
CREATE INDEX IF NOT EXISTS pagamento_remessas_remessa_idx ON public.pagamento_remessas(remessa_id);
CREATE INDEX IF NOT EXISTS pagamentos_costureira_idx ON public.pagamentos(costureira_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.pagamentos'::regclass AND tgname='trg_pagamentos_updated_at') THEN
    CREATE TRIGGER trg_pagamentos_updated_at BEFORE UPDATE ON public.pagamentos
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE OR REPLACE VIEW public.remessas_a_pagar WITH (security_invoker=true) AS
SELECT r.id AS remessa_id, r.numero, r.costureira_id, r.data_envio, r.status,
  COALESCE(SUM(ri.quantidade_retornada * ri.preco_unitario),0) AS valor_devido,
  COALESCE((SELECT SUM(pr.valor_pago) FROM public.pagamento_remessas pr WHERE pr.remessa_id=r.id),0) AS valor_ja_pago,
  COALESCE(SUM(ri.quantidade_retornada * ri.preco_unitario),0)
    - COALESCE((SELECT SUM(pr.valor_pago) FROM public.pagamento_remessas pr WHERE pr.remessa_id=r.id),0) AS valor_pendente
FROM public.remessas r
LEFT JOIN public.remessa_itens ri ON ri.remessa_id=r.id
GROUP BY r.id,r.numero,r.costureira_id,r.data_envio,r.status;

ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamento_remessas ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.pagamentos,public.pagamento_remessas TO authenticated;
GRANT ALL ON public.pagamentos,public.pagamento_remessas TO service_role;
GRANT SELECT ON public.remessas_a_pagar TO authenticated,service_role;

DO $$
DECLARE t text; a text; expression text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pagamentos','pagamento_remessas'] LOOP
    FOREACH a IN ARRAY ARRAY['select','insert','update','delete'] LOOP
      IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t || '_' || a) THEN
        expression := format('public.can(auth.uid(), ''pagamentos'', %L)', CASE a WHEN 'select' THEN 'view' WHEN 'insert' THEN 'create' ELSE a END);
        IF a='insert' THEN
          EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',t || '_' || a,t,expression);
        ELSIF a='update' THEN
          EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',t || '_' || a,t,expression,expression);
        ELSE
          EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated USING (%s)',t || '_' || a,t,upper(a),expression);
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
