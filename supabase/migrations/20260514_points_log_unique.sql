-- Idempotentność points_log:
-- Bez UNIQUE wpis można było zduplikować z dwóch urządzeń jednocześnie
-- (wyścig client-side guarda). Po tej migracji insert tego samego treningu
-- w tym samym dniu i z tego samego źródła kończy się ON CONFLICT DO NOTHING,
-- więc punkty NIE są naliczane podwójnie.
--
-- training_id IS NOT NULL — achievementy mają training_id = null i ich
-- idempotentność trzymamy osobno (na poziomie kodu, klucz: achievement_id+user).

-- 1) Najpierw posprzątaj ewentualne duplikaty żeby UNIQUE mógł powstać.
DELETE FROM points_log a
USING points_log b
WHERE a.id > b.id
  AND a.user_id     = b.user_id
  AND a.training_id = b.training_id
  AND a.date        = b.date
  AND a.source      = b.source
  AND a.training_id IS NOT NULL;

-- 2) Partial unique index — pokrywa training/shooting_session, omija achievementy.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_points_log_training_day_source
  ON points_log (user_id, training_id, date, source)
  WHERE training_id IS NOT NULL;

-- 3) Włącz Realtime publication dla cross-device sync (HomePage subskrybuje).
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE points_log;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;
