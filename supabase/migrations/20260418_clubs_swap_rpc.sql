-- ============================================================
--  HoopConnect — swap_positions RPC
--  Run AFTER 20260418_clubs.sql
-- ============================================================

-- Swaps two players between positions atomically.
-- Because club_members has UNIQUE(club_id, position) we temporarily
-- rename one row to '__swap__', update the other, then rename back.
-- security definer so the caller only needs to be logged in;
-- the function itself checks that the caller is the club owner.

create or replace function public.swap_positions(
  p_club_id uuid,
  p_pos_a   text,
  p_pos_b   text
)
returns void
language plpgsql
security definer
as $$
declare
  v_owner uuid;
begin
  -- Verify caller is club owner
  select owner_id into v_owner
    from public.clubs where id = p_club_id;

  if v_owner is distinct from auth.uid() then
    raise exception 'only the club owner can swap positions';
  end if;

  -- Atomic swap via temporary label (bypasses the unique constraint clash)
  update public.club_members
    set position = '__swap__'
    where club_id = p_club_id and position = p_pos_a;

  update public.club_members
    set position = p_pos_a
    where club_id = p_club_id and position = p_pos_b;

  update public.club_members
    set position = p_pos_b
    where club_id = p_club_id and position = '__swap__';
end;
$$;

-- Grant execute to authenticated users (RLS inside the function handles authz)
grant execute on function public.swap_positions(uuid, text, text)
  to authenticated;
