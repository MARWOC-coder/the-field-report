-- Tighten function grants: RPCs are for signed-in users only.
revoke execute on function public.is_admin(uuid) from public, anon;
revoke execute on function public.is_active_member(uuid) from public, anon;
revoke execute on function public.get_leaderboard(date, date) from public, anon;
revoke execute on function public.get_team_leaderboard(date, date) from public, anon;
revoke execute on function public.get_recent_wins(integer) from public, anon;
revoke execute on function public.get_my_stats(date) from public, anon;

-- New functions in public get default EXECUTE grants to anon via PUBLIC; stop that.
alter default privileges in schema public revoke execute on functions from public, anon;
