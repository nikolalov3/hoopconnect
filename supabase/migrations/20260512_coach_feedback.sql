-- ============================================================================
-- HoopConnect — Coach feedback ('Zgłoś / Zapytaj')
-- Jedna prosta tabela na każde zgłoszenie/pytanie z panelu trenera.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.coach_feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID REFERENCES public.coach_profiles(id) ON DELETE SET NULL,
  email       TEXT,
  message     TEXT NOT NULL,
  context_url TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_coach_feedback_created
  ON public.coach_feedback(created_at DESC);

ALTER TABLE public.coach_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach inserts own feedback" ON public.coach_feedback;
CREATE POLICY "coach inserts own feedback"
  ON public.coach_feedback FOR INSERT
  WITH CHECK (coach_id = auth.uid() OR coach_id IS NULL);

DROP POLICY IF EXISTS "coach reads own feedback" ON public.coach_feedback;
CREATE POLICY "coach reads own feedback"
  ON public.coach_feedback FOR SELECT
  USING (coach_id = auth.uid());
