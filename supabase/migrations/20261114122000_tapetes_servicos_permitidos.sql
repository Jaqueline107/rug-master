BEGIN;

ALTER TABLE public.tapetes
  ADD COLUMN servicos_permitidos uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

CREATE FUNCTION public.validar_servico_item_remessa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tapete_id = OLD.tapete_id AND NEW.servico_id = OLD.servico_id THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tapetes AS t
    WHERE t.id = NEW.tapete_id
      AND NEW.servico_id = ANY(t.servicos_permitidos)
  ) THEN
    RAISE EXCEPTION 'Este serviço não está permitido para o modelo de tapete.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validar_servico_item_remessa
  BEFORE INSERT OR UPDATE OF tapete_id, servico_id ON public.remessa_itens
  FOR EACH ROW EXECUTE FUNCTION public.validar_servico_item_remessa();

REVOKE EXECUTE ON FUNCTION public.validar_servico_item_remessa() FROM PUBLIC, anon, authenticated;

COMMIT;
