BEGIN;

ALTER TABLE public.tapetes
  ADD COLUMN servicos_permitidos uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

COMMIT;
