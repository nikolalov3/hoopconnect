-- Usuń ramkę saltearth z profilu właściciela (i każdego kto by ją miał)
UPDATE public.profiles
SET equipped_frame = NULL
WHERE equipped_frame = 'saltearth';
