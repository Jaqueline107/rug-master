ALTER TABLE public.tapetes
  ADD COLUMN ano_inicio integer,
  ADD COLUMN ano_fim integer,
  ADD CONSTRAINT tapetes_anos_compatibilidade_check CHECK (
    (ano_inicio IS NULL AND ano_fim IS NULL)
    OR (
      ano_inicio IS NOT NULL AND ano_inicio BETWEEN 1900 AND 9999
      AND (ano_fim IS NULL OR ano_fim BETWEEN ano_inicio AND 9999)
    )
  );
