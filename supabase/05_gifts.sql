-- FantasyLand – Supabase schema, phần 5: tặng quà giữa người chơi (Hòm Quà)
-- Chạy sau 01 → 04 trong Supabase Dashboard → SQL Editor (New query → dán TOÀN BỘ file → Run).
-- Chạy lại nhiều lần cũng không sao. Xong nhớ chạy: notify pgrst, 'reload schema';
--
-- Nhẹ cho gói Free: mỗi món quà là một dòng nhỏ (vài trăm byte), không đụng tới bản lưu lớn.
-- Trình duyệt chỉ gọi khi gửi quà, mở Hòm Quà, hoặc kiểm tra thư mới (tối đa vài phút một lần).
-- Giới hạn: 30 lần gửi / giờ / người, tối đa 50 quà chưa nhận trong một hòm,
-- mỗi gói tối đa 8 loại vật phẩm. Quà đã nhận tự xoá sau 14 ngày.

create table if not exists public.gifts (
  id          bigint generated always as identity primary key,
  sender      uuid references public.players (id) on delete set null,
  recipient   uuid not null references public.players (id) on delete cascade,
  items       jsonb not null default '{}'::jsonb,
  gold        integer not null default 0 check (gold >= 0),
  note        text check (char_length(note) <= 120),
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz
);

create index if not exists gifts_inbox_idx on public.gifts (recipient) where claimed_at is null;
create index if not exists gifts_sender_idx on public.gifts (sender, created_at desc);

alter table public.gifts enable row level security;
revoke all on public.gifts from anon, authenticated;

-- ---------------------------------------------------------------- RPC: gửi quà
create or replace function public.game_gift_send(p_token uuid, p_to text, p_items jsonb, p_gold integer, p_note text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_player uuid := public.game_session_player(p_token);
  v_to     uuid;
  v_items  jsonb := coalesce(p_items, '{}'::jsonb);
  v_gold   integer := coalesce(p_gold, 0);
  v_note   text := nullif(left(btrim(coalesce(p_note, '')), 120), '');
  v_id     bigint;
begin
  if v_player is null then
    return json_build_object('error', 'invalid_session');
  end if;
  select id into v_to from public.players where lower(username) = lower(btrim(p_to));
  if v_to is null then
    return json_build_object('error', 'not_found');
  end if;
  if v_to = v_player then
    return json_build_object('error', 'self_gift');
  end if;

  -- shape: {"item_id": count, ...}, 0..8 kinds, 1..9999 each; gold 0..10,000,000
  if jsonb_typeof(v_items) <> 'object'
     or (select count(*) from jsonb_object_keys(v_items)) > 8
     or exists (select 1 from jsonb_each(v_items) e
                 where char_length(e.key) > 64
                    or jsonb_typeof(e.value) <> 'number'
                    or (e.value::text)::numeric <> trunc((e.value::text)::numeric)
                    or (e.value::text)::numeric not between 1 and 9999)
     or v_gold not between 0 and 10000000
     or (v_gold = 0 and v_items = '{}'::jsonb) then
    return json_build_object('error', 'bad_gift');
  end if;

  if (select count(*) from public.gifts where sender = v_player and created_at > now() - interval '1 hour') >= 30 then
    return json_build_object('error', 'rate_limited');
  end if;
  if (select count(*) from public.gifts where recipient = v_to and claimed_at is null) >= 50 then
    return json_build_object('error', 'inbox_full');
  end if;

  insert into public.gifts (sender, recipient, items, gold, note)
  values (v_player, v_to, v_items, v_gold, v_note)
  returning id into v_id;

  -- housekeeping: the table only ever holds recent gifts
  delete from public.gifts where claimed_at < now() - interval '14 days';

  return json_build_object('id', v_id);
end;
$fn$;

-- ---------------------------------------------------------------- RPC: xem hòm quà
create or replace function public.game_gift_inbox(p_token uuid)
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
  return json_build_object(
    'inbox', coalesce((
      select json_agg(row_to_json(r) order by r.created_at desc)
      from (
        select g.id, coalesce(p.username, '???') as sender, g.items, g.gold, g.note, g.created_at
          from public.gifts g
          left join public.players p on p.id = g.sender
         where g.recipient = v_player and g.claimed_at is null
         order by g.created_at desc
         limit 50
      ) r
    ), '[]'::json),
    'sent', coalesce((
      select json_agg(row_to_json(r) order by r.created_at desc)
      from (
        select g.id, p.username as recipient, g.items, g.gold, g.note, g.created_at, g.claimed_at
          from public.gifts g
          join public.players p on p.id = g.recipient
         where g.sender = v_player
         order by g.created_at desc
         limit 15
      ) r
    ), '[]'::json));
end;
$fn$;

-- ---------------------------------------------------------------- RPC: nhận quà (p_id null = nhận hết)
create or replace function public.game_gift_claim(p_token uuid, p_id bigint)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_player uuid := public.game_session_player(p_token);
  v_got    json;
begin
  if v_player is null then
    return json_build_object('error', 'invalid_session');
  end if;
  with c as (
    update public.gifts
       set claimed_at = now()
     where recipient = v_player
       and claimed_at is null
       and (p_id is null or id = p_id)
    returning id, items, gold
  )
  select json_agg(row_to_json(c)) into v_got from c;
  return json_build_object('gifts', coalesce(v_got, '[]'::json));
end;
$fn$;

revoke all on function public.game_gift_send(uuid, text, jsonb, integer, text) from public;
revoke all on function public.game_gift_inbox(uuid) from public;
revoke all on function public.game_gift_claim(uuid, bigint) from public;
grant execute on function public.game_gift_send(uuid, text, jsonb, integer, text) to anon, authenticated;
grant execute on function public.game_gift_inbox(uuid) to anon, authenticated;
grant execute on function public.game_gift_claim(uuid, bigint) to anon, authenticated;
