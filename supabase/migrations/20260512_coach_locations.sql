-- ============================================================================
-- HoopConnect — Coach saved locations
-- Każdy trener ma własną prywatną listę zapisanych miejsc treningów.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.coach_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_coach_location_name
  ON public.coach_locations(coach_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_coach_locations_coach
  ON public.coach_locations(coach_id);

ALTER TABLE public.coach_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach manages own locations" ON public.coach_locations;
CREATE POLICY "coach manages own locations"
  ON public.coach_locations FOR ALL
  USING       (coach_id = auth.uid())
  WITH CHECK  (coach_id = auth.uid());
