-- FantasyLand – Supabase schema, phần 4: xem người chơi khác, sang thăm Thánh Địa
-- Chạy sau 01 → 02 → 03 trong Supabase Dashboard → SQL Editor (New query → dán TOÀN BỘ file → Run).
-- Chạy lại nhiều lần cũng không sao. Xong nhớ chạy: notify pgrst, 'reload schema';
--
-- Chỉ trả về phần công khai của bản lưu (nhân vật trong đội, công trình, vài con số thành tích).
-- Túi đồ, vàng, nhật ký, quan hệ... của người khác không bao giờ rời khỏi máy chủ.

-- ---------------------------------------------------------------- helpers
create or replace function public.game_public_char(p_data jsonb, p_id text)
returns jsonb
language sql
immutable
as $fn$
  select case when c is null then null else jsonb_build_object(
    'id', p_id,
    'name', c->'name',
    'classId', c->'classId',
    'sprite', c->'sprite',
    'level', c->'level',
    'pal', c->'pal',
    'gear', c->'gear',
    'enh', c->'enh',
    'bond', c->'bond'
  ) end
  from (select p_data->'chars'->p_id as c) s;
$fn$;

-- ---------------------------------------------------------------- RPC: danh sách người chơi
create or replace function public.game_players(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_player uuid := public.game_session_player(p_token);
begin
  if v_player is null then
    return json_build_object('error', 'invalid_session');
  end if;
  return json_build_object('players', coalesce((
    select json_agg(row_to_json(r) order by r.updated_at desc)
    from (
      select p.username,
             s.updated_at,
             public.game_public_char(s.data, s.data->>'heroId') as hero,
             coalesce((s.data->>'maxFloor')::int, 0) as max_floor,
             coalesce((s.data->>'day')::int, 1) as day,
             coalesce((s.data->>'territory')::int, 0) as territory,
             coalesce(jsonb_array_length(s.data->'buildings'), 0) as buildings,
             coalesce((select max((b->>'level')::int) from jsonb_array_elements(coalesce(s.data->'buildings', '[]'::jsonb)) b
                        where b->>'type' = 'house'), 1) as rank
        from public.saves s
        join public.players p on p.id = s.player_id
       where s.player_id <> v_player
         and s.data ? 'heroId'
       order by s.updated_at desc
       limit 200
    ) r
  ), '[]'::json));
end;
$fn$;

-- ---------------------------------------------------------------- RPC: xem hồ sơ / sang thăm
create or replace function public.game_visit(p_token uuid, p_username text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_player uuid := public.game_session_player(p_token);
  v_name   text;
  v_data   jsonb;
  v_upd    timestamptz;
begin
  if v_player is null then
    return json_build_object('error', 'invalid_session');
  end if;
  select p.username, s.data, s.updated_at into v_name, v_data, v_upd
    from public.players p join public.saves s on s.player_id = p.id
   where lower(p.username) = lower(p_username);
  if v_data is null then
    return json_build_object('error', 'not_found');
  end if;
  return json_build_object(
    'username', v_name,
    'updated_at', v_upd,
    'v', v_data->'v',
    'heroId', v_data->'heroId',
    'party', (select coalesce(jsonb_agg(public.game_public_char(v_data, x)), '[]'::jsonb)
                from jsonb_array_elements_text(jsonb_build_array(v_data->'heroId') || coalesce(v_data->'party', '[]'::jsonb)) x),
    'residents', (select count(*) from jsonb_object_keys(coalesce(v_data->'chars', '{}'::jsonb))),
    'day', v_data->'day',
    'maxFloor', v_data->'maxFloor',
    'territory', v_data->'territory',
    'settlers', v_data->'settlers',
    'weather', v_data->'weather',
    'stats', v_data->'stats',
    'buildings', (select coalesce(jsonb_agg(jsonb_build_object(
                     'type', b->'type', 'x', b->'x', 'y', b->'y', 'level', b->'level',
                     'plot', case when b ? 'plot' then jsonb_build_object('soil', b->'plot'->'soil', 'crop', b->'plot'->'crop') end)), '[]'::jsonb)
                    from jsonb_array_elements(coalesce(v_data->'buildings', '[]'::jsonb)) b)
  );
end;
$fn$;

revoke all on function public.game_public_char(jsonb, text) from public;
revoke all on function public.game_players(uuid) from public;
revoke all on function public.game_visit(uuid, text) from public;
grant execute on function public.game_players(uuid) to anon, authenticated;
grant execute on function public.game_visit(uuid, text) to anon, authenticated;
