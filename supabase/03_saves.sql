-- FantasyLand – Supabase schema, phần 3/3: tải / lưu game, đăng xuất
-- Chạy lần lượt 01 → 02 → 03 trong Supabase Dashboard → SQL Editor (New query → dán TOÀN BỘ file → Run).
-- Mỗi file chạy lại nhiều lần cũng không sao.

-- ---------------------------------------------------------------- RPC: load
create or replace function public.game_load(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_player uuid := public.game_session_player(p_token);
  v_save   public.saves;
  v_name   text;
begin
  if v_player is null then
    return json_build_object('error', 'invalid_session');
  end if;
  select username into v_name from public.players where id = v_player;
  select * into v_save from public.saves where player_id = v_player;
  return json_build_object(
    'username', v_name,
    'data', v_save.data,
    'version', coalesce(v_save.version, 0),
    'updated_at', v_save.updated_at
  );
end;
$fn$;

-- ---------------------------------------------------------------- RPC: save
create or replace function public.game_save(p_token uuid, p_data jsonb, p_base_version integer, p_force boolean default false)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_player  uuid := public.game_session_player(p_token);
  v_current integer;
begin
  if v_player is null then
    return json_build_object('error', 'invalid_session');
  end if;
  if pg_column_size(p_data) > 2000000 then
    return json_build_object('error', 'too_large');
  end if;

  select version into v_current from public.saves where player_id = v_player for update;

  if v_current is null then
    insert into public.saves (player_id, data, version) values (v_player, p_data, 1);
    return json_build_object('version', 1);
  end if;

  if v_current <> p_base_version and not p_force then
    return json_build_object('error', 'conflict', 'version', v_current);
  end if;

  update public.saves
     set data = p_data, version = v_current + 1, updated_at = now()
   where player_id = v_player;
  return json_build_object('version', v_current + 1);
end;
$fn$;

-- ---------------------------------------------------------------- RPC: logout
create or replace function public.game_logout(p_token uuid)
returns json
language sql
security definer
set search_path = public, extensions
as $fn$
  delete from public.sessions where token = p_token;
  select json_build_object('ok', true);
$fn$;

revoke all on function public.game_load(uuid) from public;
revoke all on function public.game_save(uuid, jsonb, integer, boolean) from public;
revoke all on function public.game_logout(uuid) from public;
grant execute on function public.game_load(uuid) to anon, authenticated;
grant execute on function public.game_save(uuid, jsonb, integer, boolean) to anon, authenticated;
grant execute on function public.game_logout(uuid) to anon, authenticated;
