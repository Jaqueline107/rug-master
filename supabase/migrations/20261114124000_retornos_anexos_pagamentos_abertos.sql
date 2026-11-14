BEGIN;

ALTER TABLE public.retornos
  ADD COLUMN foto_retorno_path text UNIQUE,
  ADD COLUMN ordem integer;

WITH numerados AS (
  SELECT id, row_number() OVER (PARTITION BY remessa_id ORDER BY created_at, id)::integer AS ordem
  FROM public.retornos
)
UPDATE public.retornos r SET ordem = n.ordem FROM numerados n WHERE n.id = r.id;
ALTER TABLE public.retornos ALTER COLUMN ordem SET NOT NULL,
  ADD CONSTRAINT retornos_remessa_ordem_key UNIQUE (remessa_id, ordem);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fotos-retornos', 'fotos-retornos', false, 10485760, ARRAY['image/jpeg','image/png','image/webp']);

CREATE POLICY fotos_retornos_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'fotos-retornos' AND public.can(auth.uid(), 'remessas', 'update')
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
CREATE POLICY fotos_retornos_consulta ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'fotos-retornos' AND (
    ((storage.foldername(name))[1] = (SELECT auth.uid())::text AND public.can(auth.uid(), 'remessas', 'update'))
    OR (public.can(auth.uid(), 'remessas', 'view') AND EXISTS (
      SELECT 1 FROM public.retornos r WHERE r.foto_retorno_path = name
    ))
  )
);
CREATE POLICY fotos_retornos_limpar_upload ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'fotos-retornos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND public.can(auth.uid(), 'remessas', 'update') AND public.can(auth.uid(), 'remessas', 'view')
  AND NOT EXISTS (SELECT 1 FROM public.retornos r WHERE r.foto_retorno_path = name)
);

CREATE FUNCTION public.validar_novo_retorno()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.foto_retorno_path IS DISTINCT FROM OLD.foto_retorno_path
      OR NEW.ordem IS DISTINCT FROM OLD.ordem OR NEW.remessa_id IS DISTINCT FROM OLD.remessa_id THEN
      RAISE EXCEPTION 'Não é possível substituir a foto ou a numeração de um retorno.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  PERFORM 1 FROM public.remessas WHERE id = NEW.remessa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Remessa não encontrada.'; END IF;
  IF NEW.foto_retorno_path IS NOT NULL AND (
    split_part(NEW.foto_retorno_path, '/', 1) IS DISTINCT FROM auth.uid()::text
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'fotos-retornos' AND o.name = NEW.foto_retorno_path
    )
  )
  THEN
    RAISE EXCEPTION 'Anexe uma foto da folha de retorno preenchida.' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(MAX(r.ordem),0)+1 INTO NEW.ordem FROM public.retornos r WHERE r.remessa_id = NEW.remessa_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_novo_retorno BEFORE INSERT OR UPDATE OF foto_retorno_path, ordem, remessa_id ON public.retornos
FOR EACH ROW EXECUTE FUNCTION public.validar_novo_retorno();
REVOKE EXECUTE ON FUNCTION public.validar_novo_retorno() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.registrar_retorno_com_foto(
  p_remessa_id uuid, p_data_retorno date, p_observacoes text, p_foto text, p_itens jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_id uuid;
  v_item record;
  v_pendente integer;
BEGIN
  IF p_foto IS NULL THEN
    RAISE EXCEPTION 'Anexe uma foto da folha de retorno preenchida.' USING ERRCODE = '23514';
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'Informe os itens do retorno.';
  END IF;
  IF jsonb_array_length(p_itens) = 0 THEN RAISE EXCEPTION 'Informe ao menos uma quantidade.'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_itens) AS i(remessa_item_id uuid)
    GROUP BY i.remessa_item_id HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Há itens repetidos no retorno.'; END IF;

  INSERT INTO public.retornos (remessa_id, data_retorno, observacoes, foto_retorno_path)
  VALUES (p_remessa_id, p_data_retorno, p_observacoes, p_foto) RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_itens) AS i(remessa_item_id uuid, quantidade integer) LOOP
    SELECT quantidade_enviada - quantidade_retornada INTO v_pendente
    FROM public.remessa_itens WHERE id = v_item.remessa_item_id AND remessa_id = p_remessa_id FOR UPDATE;
    IF NOT FOUND OR v_item.quantidade IS NULL OR v_item.quantidade <= 0 OR v_item.quantidade > v_pendente THEN
      RAISE EXCEPTION 'A quantidade de retorno é inválida ou excede o saldo pendente.' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.retorno_itens (retorno_id, remessa_item_id, quantidade)
    VALUES (v_id, v_item.remessa_item_id, v_item.quantidade);
  END LOOP;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_retorno_com_foto(uuid, date, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_retorno_com_foto(uuid, date, text, text, jsonb) TO authenticated;

CREATE OR REPLACE VIEW public.remessas_a_pagar WITH (security_invoker = true) AS
SELECT r.id AS remessa_id, r.numero, r.costureira_id, r.data_envio, r.status,
  COALESCE(SUM(ri.quantidade_retornada * ri.preco_unitario), 0) AS valor_devido,
  COALESCE((SELECT SUM(pr.valor_pago) FROM public.pagamento_remessas pr WHERE pr.remessa_id = r.id), 0) AS valor_ja_pago,
  COALESCE(SUM(ri.quantidade_retornada * ri.preco_unitario), 0)
    - COALESCE((SELECT SUM(pr.valor_pago) FROM public.pagamento_remessas pr WHERE pr.remessa_id = r.id), 0) AS valor_pendente,
  COALESCE(SUM(ri.quantidade_enviada * ri.preco_unitario), 0) AS valor_total_enviado,
  COALESCE(SUM(ri.quantidade_enviada * ri.preco_unitario), 0)
    - COALESCE((SELECT SUM(pr.valor_pago) FROM public.pagamento_remessas pr WHERE pr.remessa_id = r.id), 0) AS saldo_total_enviado
FROM public.remessas r
LEFT JOIN public.remessa_itens ri ON ri.remessa_id = r.id
GROUP BY r.id, r.numero, r.costureira_id, r.data_envio, r.status;

NOTIFY pgrst, 'reload schema';
COMMIT;
