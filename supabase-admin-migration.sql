-- Admin + ban migration
-- Run this in Supabase SQL Editor once.

alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists banned boolean not null default false;

-- Helper function so policies can check admin status without recursion.
create or replace function public.current_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- Allow admins to update any profile row (chips, banned).
drop policy if exists "profiles update admin" on public.profiles;
create policy "profiles update admin" on public.profiles
  for update
  using (public.current_is_admin())
  with check (public.current_is_admin());

-- ---- AFTER you log in once as yourself, make your account admin:
-- update public.profiles set is_admin = true where username = 'YOUR_USERNAME';
