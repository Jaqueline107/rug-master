
CREATE POLICY "comprovantes_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comprovantes' AND public.can(auth.uid(),'pagamentos','view'));
CREATE POLICY "comprovantes_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprovantes' AND public.can(auth.uid(),'pagamentos','create'));
CREATE POLICY "comprovantes_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'comprovantes' AND public.can(auth.uid(),'pagamentos','update'))
  WITH CHECK (bucket_id = 'comprovantes' AND public.can(auth.uid(),'pagamentos','update'));
CREATE POLICY "comprovantes_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comprovantes' AND public.can(auth.uid(),'pagamentos','delete'));
