-- Chạy file này trong Supabase Dashboard → SQL Editor (một lần).
create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  name        text        not null check (char_length(name) between 1 and 16),
  score       integer     not null check (score between 0 and 10000000),
  wave        integer     not null check (wave between 1 and 1000),
  created_at  timestamptz not null default now()
);

create index if not exists scores_score_idx on public.scores (score desc, created_at);

-- Row Level Security: ai cũng đọc được và gửi điểm mới, nhưng không sửa/xoá được.
alter table public.scores enable row level security;

drop policy if exists "scores are public" on public.scores;
create policy "scores are public"
  on public.scores for select
  to anon, authenticated
  using (true);

drop policy if exists "anyone can submit a score" on public.scores;
create policy "anyone can submit a score"
  on public.scores for insert
  to anon, authenticated
  with check (true);

grant select, insert on public.scores to anon, authenticated;
