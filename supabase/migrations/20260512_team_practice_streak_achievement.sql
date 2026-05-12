-- ============================================================================
-- HoopConnect — 'Filar drużyny' staged achievement
-- Odblokowuje się za X treningów drużynowych pod rząd (present/late).
-- Status 'absent' resetuje serię; brak zaznaczenia jest ignorowany.
-- ============================================================================

INSERT INTO public.achievements_catalog (id, title, description, type, stages, is_active)
VALUES (
  'team_practice_streak',
  'Filar drużyny',
  'Obecność na treningach drużynowych pod rząd.',
  'staged',
  '[
    {"medal": "bronze",   "threshold": 5,   "title": "Filar drużyny · Brąz"},
    {"medal": "silver",   "threshold": 10,  "title": "Filar drużyny · Srebro"},
    {"medal": "gold",     "threshold": 25,  "title": "Filar drużyny · Złoto"},
    {"medal": "platinum", "threshold": 50,  "title": "Filar drużyny · Platyna"},
    {"medal": "diamond",  "threshold": 100, "title": "Filar drużyny · Diament"}
  ]'::jsonb,
  TRUE
)
ON CONFLICT (id) DO UPDATE
  SET title       = EXCLUDED.title,
      description = EXCLUDED.description,
      stages      = EXCLUDED.stages,
      is_active   = EXCLUDED.is_active;
