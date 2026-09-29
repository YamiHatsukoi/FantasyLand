-- FantasyLand – Supabase schema, phần 1/3: bảng, RLS, trigger băm mật khẩu
-- Chạy lần lượt 01 → 02 → 03 trong Supabase Dashboard → SQL Editor (New query → dán TOÀN BỘ file → Run).
-- Mỗi file chạy lại nhiều lần cũng không sao.

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
as $fn$
begin
  -- Only hash values that are not already bcrypt hashes.
  if new.password is not null and new.password !~ '^[$]2[abxy][$][0-9]{2}[$]' then
    new.password := crypt(new.password, gen_salt('bf', 10));
  end if;
  return new;
end;
$fn$;

drop trigger if exists players_hash_password on public.players;
create trigger players_hash_password
  before insert or update of password on public.players
  for each row execute function public.players_hash_password();

-- ---------------------------------------------------------------- tạo tài khoản
-- Cách 1: Table Editor → players → Insert row → điền username + password (mật khẩu thường, sẽ tự băm).
-- Cách 2: SQL:
--   insert into public.players (username, password) values ('tenban', 'matkhau123');
-- Đổi mật khẩu: update public.players set password = 'matkhaumoi' where username = 'tenban';
