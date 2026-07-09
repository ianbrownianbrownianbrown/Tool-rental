-- Run this in the Supabase SQL Editor for the HoneyDo / Tool Rental project.
-- It allows this guest prototype to read and create public tool listings.

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  tool_name text not null,
  category text,
  neighborhood text,
  daily_price text,
  weekend_price text,
  deposit text,
  description text,
  owner_name text,
  owner_contact text,
  status text not null default 'available',
  created_at timestamptz not null default now()
);

alter table public.listings enable row level security;

drop policy if exists "Anyone can read available listings" on public.listings;
create policy "Anyone can read available listings"
on public.listings
for select
using (status = 'available');

drop policy if exists "Guests can create listings" on public.listings;
create policy "Guests can create listings"
on public.listings
for insert
with check (status = 'available');
