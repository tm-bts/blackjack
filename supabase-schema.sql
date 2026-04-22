-- Gambling Life: schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run)

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  chips bigint not null default 1000,
  hands_played int not null default 0,
  hands_won int not null default 0,
  last_bonus_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- anyone signed in can read all profiles (leaderboard)
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
  for select using (true);

-- users can insert their own profile
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = id);

-- users can update only their own profile
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- helpful index for leaderboard
create index if not exists profiles_chips_idx on public.profiles (chips desc);
