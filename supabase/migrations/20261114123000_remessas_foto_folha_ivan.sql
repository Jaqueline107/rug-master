BEGIN;

ALTER TABLE public.remessas ADD COLUMN foto_folha_ivan_path text UNIQUE;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('folhas-ivan', 'folhas-ivan', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']);

CREATE POLICY folhas_ivan_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'folhas-ivan' AND public.can(auth.uid(), 'remessas', 'create')
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY folhas_ivan_consulta ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'folhas-ivan' AND (
  ((storage.foldername(name))[1] = (SELECT auth.uid())::text AND public.can(auth.uid(), 'remessas', 'create'))
  OR (public.can(auth.uid(), 'remessas', 'view') AND EXISTS (
    SELECT 1 FROM public.remessas r WHERE r.foto_folha_ivan_path = name
  ))
));

CREATE POLICY folhas_ivan_limpar_upload ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'folhas-ivan' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND public.can(auth.uid(), 'remessas', 'create')
  AND public.can(auth.uid(), 'remessas', 'view')
  AND NOT EXISTS (SELECT 1 FROM public.remessas r WHERE r.foto_folha_ivan_path = name));

CREATE FUNCTION public.criar_remessa_com_folha_ivan(
  p_costureira_id uuid, p_data_envio date, p_data_prevista_retorno date,
  p_observacoes text, p_foto text, p_itens jsonb
)
RETURNS TABLE (id uuid, numero integer) LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_id uuid;
  v_numero integer;
BEGIN
  IF p_foto IS NULL
    OR split_part(p_foto, '/', 1) IS DISTINCT FROM auth.uid()::text
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'folhas-ivan' AND o.name = p_foto
    )
  THEN
    RAISE EXCEPTION 'Anexe uma foto da Folha Ivan para criar a remessa.' USING ERRCODE = '23514';
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'Informe os itens da remessa.';
  END IF;
  IF jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Adicione ao menos um item.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_itens) AS i(tapete_id uuid, servico_id uuid)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tapetes t WHERE t.id = i.tapete_id AND i.servico_id = ANY(t.servicos_permitidos)
    )
  ) THEN
    RAISE EXCEPTION 'Este serviço não está permitido para o modelo de tapete.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.remessas AS r (costureira_id, data_envio, data_prevista_retorno, observacoes, foto_folha_ivan_path)
  VALUES (p_costureira_id, p_data_envio, p_data_prevista_retorno, p_observacoes, p_foto)
  RETURNING r.id, r.numero INTO v_id, v_numero;

  INSERT INTO public.remessa_itens (remessa_id, tapete_id, servico_id, quantidade_enviada, preco_unitario)
  SELECT v_id, i.tapete_id, i.servico_id, i.quantidade_enviada, i.preco_unitario
  FROM jsonb_to_recordset(p_itens) AS i(tapete_id uuid, servico_id uuid, quantidade_enviada integer, preco_unitario numeric);

  RETURN QUERY SELECT v_id, v_numero;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_remessa_com_folha_ivan(uuid, date, date, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_remessa_com_folha_ivan(uuid, date, date, text, text, jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
