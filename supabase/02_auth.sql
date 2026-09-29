-- FantasyLand – Supabase schema, phần 2/3: đăng nhập
-- Chạy lần lượt 01 → 02 → 03 trong Supabase Dashboard → SQL Editor (New query → dán TOÀN BỘ file → Run).
-- Mỗi file chạy lại nhiều lần cũng không sao.

-- ---------------------------------------------------------------- helpers
create or replace function public.game_session_player(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_player uuid;
begin
  update public.sessions
     set expires_at = now() + interval '30 days'
   where token = p_token and expires_at > now()
  returning player_id into v_player;
  return v_player;
end;
$fn$;

revoke all on function public.game_session_player(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- RPC: login
create or replace function public.game_login(p_username text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_player public.players;
  v_token  uuid;
begin
  select * into v_player from public.players where lower(username) = lower(trim(p_username));

  if not found then
    perform pg_sleep(0.4);
    return json_build_object('error', 'invalid_credentials');
  end if;

  if v_player.locked_until is not null and v_player.locked_until > now() then
    return json_build_object('error', 'locked', 'until', v_player.locked_until);
  end if;

  if v_player.password <> crypt(coalesce(p_password, ''), v_player.password) then
    update public.players
       set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
           locked_until    = case when failed_attempts + 1 >= 5 then now() + interval '5 minutes' else null end
     where id = v_player.id;
    perform pg_sleep(0.4);
    return json_build_object('error', 'invalid_credentials');
  end if;

  update public.players set failed_attempts = 0, locked_until = null where id = v_player.id;
  delete from public.sessions where player_id = v_player.id and expires_at < now();
  insert into public.sessions (player_id) values (v_player.id) returning token into v_token;

  return json_build_object('token', v_token, 'username', v_player.username);
end;
$fn$;

revoke all on function public.game_login(text, text) from public;
grant execute on function public.game_login(text, text) to anon, authenticated;
