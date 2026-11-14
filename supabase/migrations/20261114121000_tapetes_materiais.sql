ALTER TABLE public.tapetes
  ADD COLUMN materiais text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD CONSTRAINT tapetes_materiais_check CHECK (
    materiais <@ ARRAY['Frisado', 'Carpete', 'Canelado']::text[]
  );
