-- Play Pool database schema.
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).

-- Player profiles, filled in automatically on first sign-in.
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles readable by everyone"
  on public.profiles for select using (true);
create policy "users insert own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "users update own profile"
  on public.profiles for update using (auth.uid() = id);

-- One row per finished game.
create table if not exists public.game_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  mode text not null default '8ball',
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  won boolean not null,
  balls_potted int not null default 0,
  fouls int not null default 0,
  shots int not null default 0,
  played_at timestamptz not null default now()
);
alter table public.game_results enable row level security;

create policy "users read own results"
  on public.game_results for select using (auth.uid() = user_id);
create policy "users insert own results"
  on public.game_results for insert with check (auth.uid() = user_id);

create index if not exists game_results_user_idx
  on public.game_results (user_id, played_at desc);

-- Aggregated stats per player (same shape the game keeps on-device).
create table if not exists public.player_stats (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.player_stats enable row level security;

-- readable by everyone so the leaderboard works
create policy "stats readable by everyone"
  on public.player_stats for select using (true);
create policy "users insert own stats"
  on public.player_stats for insert with check (auth.uid() = user_id);
create policy "users update own stats"
  on public.player_stats for update using (auth.uid() = user_id);

-- Public leaderboard.
create or replace view public.leaderboard
  with (security_invoker = on) as
select
  p.display_name,
  coalesce((s.data ->> 'totalWins')::int, 0) as wins,
  coalesce((s.data ->> 'games')::int, 0) as games,
  coalesce((s.data ->> 'bestStreak')::int, 0) as best_streak
from public.player_stats s
join public.profiles p on p.id = s.user_id;

-- Create a profile automatically whenever a new user signs in for the first time.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'Player'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
