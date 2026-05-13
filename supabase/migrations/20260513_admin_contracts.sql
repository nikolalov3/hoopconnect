-- ============================================================================
-- HoopConnect — Admin panel (gu.hoopconnect.pl): contract history
-- ============================================================================
-- Cel: historia wystawionych umów dla konta administratora (kontakt@hoopconnect.pl).
-- Wszystko zamknięte RLS-em na email JWT — tylko admin widzi i modyfikuje.
-- PDFy lądują w Supabase Storage bucket 'admin_contracts' (prywatny).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_contracts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Dane Klubu (snapshot z momentu wygenerowania)
  klub_nazwa        TEXT NOT NULL,
  klub_adres        TEXT,
  klub_nip          TEXT,
  klub_reprezentant TEXT,
  klub_email        TEXT,

  -- Szczegóły umowy
  data_zawarcia     TEXT,
  miasto            TEXT,

  -- PDF i wysyłka
  pdf_path          TEXT,                -- relative path in storage.admin_contracts bucket
  sent_to           TEXT,
  sent_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_contracts_created
  ON public.admin_contracts(created_at DESC);

ALTER TABLE public.admin_contracts ENABLE ROW LEVEL SECURITY;

-- Tylko email administratora widzi/edytuje wpisy.
DROP POLICY IF EXISTS "admin manages contracts" ON public.admin_contracts;
CREATE POLICY "admin manages contracts"
  ON public.admin_contracts FOR ALL
  USING       (lower(auth.jwt() ->> 'email') = 'kontakt@hoopconnect.pl')
  WITH CHECK  (lower(auth.jwt() ->> 'email') = 'kontakt@hoopconnect.pl');


-- ── STORAGE BUCKET ─────────────────────────────────────────────────────────
-- Bucket prywatny. RLS na storage.objects pozwala adminowi czytać/pisać/usuwać
-- tylko obiekty w tym bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('admin_contracts', 'admin_contracts', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "admin reads contract pdfs" ON storage.objects;
CREATE POLICY "admin reads contract pdfs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'admin_contracts'
    AND lower(auth.jwt() ->> 'email') = 'kontakt@hoopconnect.pl'
  );

DROP POLICY IF EXISTS "admin uploads contract pdfs" ON storage.objects;
CREATE POLICY "admin uploads contract pdfs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'admin_contracts'
    AND lower(auth.jwt() ->> 'email') = 'kontakt@hoopconnect.pl'
  );

DROP POLICY IF EXISTS "admin deletes contract pdfs" ON storage.objects;
CREATE POLICY "admin deletes contract pdfs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'admin_contracts'
    AND lower(auth.jwt() ->> 'email') = 'kontakt@hoopconnect.pl'
  );
