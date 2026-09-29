-- FantasyLand – Supabase schema.
-- Chạy toàn bộ file này một lần trong Supabase Dashboard → SQL Editor.
--
-- Thiết kế bảo mật:
--   * Trình duyệt KHÔNG đọc/ghi trực tiếp bảng nào (RLS bật, không có policy, quyền bị thu hồi).
--   * Mọi thao tác đi qua các hàm RPC `game_*` (security definer) chạy trên server.
--   * Mật khẩu được băm bcrypt tự động bởi trigger — bạn chỉ cần gõ mật khẩu thường
--     khi tạo tài khoản trong Table Editor.
--   * Đăng nhập trả về token phiên (30 ngày, tự gia hạn); client chỉ cache token, không cache mật khẩu.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables
create table if not exists public.players (
  id               uuid primary key default gen_random_uuid(),
  username         text not null unique check (char_length(username) between 3 and 32),
  password         text not null,
  failed_attempts  integer not null default 0,
  locked_until     timestamptz,
  created_at       timestamptz not null default now()
);

create unique index if not exists players_username_lower_idx on public.players (lower(username));

create table if not exists public.sessions (
  token       uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days'
);

create index if not exists sessions_player_idx on public.sessions (player_id);

create table if not exists public.saves (
  player_id   uuid primary key references public.players (id) on delete cascade,
  data        jsonb not null,
  version     integer not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.players  enable row level security;
alter table public.sessions enable row level security;
alter table public.saves    enable row level security;

revoke all on public.players, public.sessions, public.saves from anon, authenticated;

-- ---------------------------------------------------------------- password hashing
create or replace function public.players_hash_password()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  -- Only hash values that are not already bcrypt hashes.
  if new.password is not null and new.password !~ '^\$2[abxy]\$\d\d\$' then
    new.password := crypt(new.password, gen_salt('bf', 10));
  end if;
  return new;
end;
$$;

drop trigger if exists players_hash_password on public.players;
create trigger players_hash_password
  before insert or update of password on public.players
  for each row execute function public.players_hash_password();

-- ---------------------------------------------------------------- helpers
create or replace function public.game_session_player(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_player uuid;
begin
  update public.sessions
     set expires_at = now() + interval '30 days'
   where token = p_token and expires_at > now()
  returning player_id into v_player;
  return v_player;
end;
$$;

revoke all on function public.game_session_player(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- RPC: login
create or replace function public.game_login(p_username text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
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
$$;

-- ---------------------------------------------------------------- RPC: load
create or replace function public.game_load(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
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
$$;

-- ---------------------------------------------------------------- RPC: save
create or replace function public.game_save(p_token uuid, p_data jsonb, p_base_version integer, p_force boolean default false)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
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
$$;

-- ---------------------------------------------------------------- RPC: logout
create or replace function public.game_logout(p_token uuid)
returns json
language sql
security definer
set search_path = public, extensions
as $$
  delete from public.sessions where token = p_token;
  select json_build_object('ok', true);
$$;

revoke all on function public.game_login(text, text) from public;
revoke all on function public.game_load(uuid) from public;
revoke all on function public.game_save(uuid, jsonb, integer, boolean) from public;
revoke all on function public.game_logout(uuid) from public;
grant execute on function public.game_login(text, text) to anon, authenticated;
grant execute on function public.game_load(uuid) to anon, authenticated;
grant execute on function public.game_save(uuid, jsonb, integer, boolean) to anon, authenticated;
grant execute on function public.game_logout(uuid) to anon, authenticated;

-- ---------------------------------------------------------------- tạo tài khoản
-- Cách 1: Table Editor → players → Insert row → điền username + password (mật khẩu thường, sẽ tự băm).
-- Cách 2: SQL:
--   insert into public.players (username, password) values ('tenban', 'matkhau123');
-- Đổi mật khẩu: update public.players set password = 'matkhaumoi' where username = 'tenban';
