-- FantasyLand – Supabase schema, phần 6: bản lưu của game Adventure (gamebook)
-- Chạy SAU các file 01 → 03 (dùng chung bảng players / sessions và hàm game_login / game_logout).
-- Dán TOÀN BỘ file vào Supabase Dashboard → SQL Editor → Run. Chạy lại nhiều lần cũng không sao.
--
-- Mỗi tài khoản có nhiều ô lưu cho mỗi cuốn sách: (player_id, book_id, slot).
-- Bảng `saves` của FantasyLand KHÔNG bị đụng tới.

create table if not exists public.adv_saves (
  player_id   uuid not null references public.players (id) on delete cascade,
  book_id     text not null check (book_id ~ '^[a-z0-9_-]{1,40}$'),
  slot        smallint not null check (slot between 0 and 9),
  data        jsonb not null,
  version     integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (player_id, book_id, slot)
);

alter table public.adv_saves enable row level security;
revoke all on public.adv_saves from anon, authenticated;

-- ---------------------------------------------------------------- RPC: danh sách ô lưu của một cuốn sách
create or replace function public.adv_load(p_token uuid, p_book text)
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
  return json_build_object('slots', coalesce((
    select json_agg(json_build_object('slot', slot, 'data', data, 'version', version, 'updated_at', updated_at) order by slot)
      from public.adv_saves
     where player_id = v_player and book_id = p_book
  ), '[]'::json));
end;
$fn$;

-- ---------------------------------------------------------------- RPC: lưu một ô (chống ghi đè khi mở 2 thiết bị)
create or replace function public.adv_save(p_token uuid, p_book text, p_slot integer, p_data jsonb, p_base_version integer, p_force boolean default false)
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
  if p_slot not between 0 and 9 or p_book !~ '^[a-z0-9_-]{1,40}$' then
    return json_build_object('error', 'bad_slot');
  end if;
  if pg_column_size(p_data) > 500000 then
    return json_build_object('error', 'too_large');
  end if;

  select version into v_current from public.adv_saves
   where player_id = v_player and book_id = p_book and slot = p_slot for update;

  if v_current is null then
    insert into public.adv_saves (player_id, book_id, slot, data, version) values (v_player, p_book, p_slot, p_data, 1);
    return json_build_object('version', 1);
  end if;

  if v_current <> p_base_version and not p_force then
    return json_build_object('error', 'conflict', 'version', v_current);
  end if;

  update public.adv_saves
     set data = p_data, version = v_current + 1, updated_at = now()
   where player_id = v_player and book_id = p_book and slot = p_slot;
  return json_build_object('version', v_current + 1);
end;
$fn$;

-- ---------------------------------------------------------------- RPC: xoá một ô
create or replace function public.adv_delete(p_token uuid, p_book text, p_slot integer)
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
  delete from public.adv_saves where player_id = v_player and book_id = p_book and slot = p_slot;
  return json_build_object('ok', true);
end;
$fn$;

revoke all on function public.adv_load(uuid, text) from public;
revoke all on function public.adv_save(uuid, text, integer, jsonb, integer, boolean) from public;
revoke all on function public.adv_delete(uuid, text, integer) from public;
grant execute on function public.adv_load(uuid, text) to anon, authenticated;
grant execute on function public.adv_save(uuid, text, integer, jsonb, integer, boolean) to anon, authenticated;
grant execute on function public.adv_delete(uuid, text, integer) to anon, authenticated;

notify pgrst, 'reload schema';
