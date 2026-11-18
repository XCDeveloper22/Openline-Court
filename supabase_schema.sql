-- Openline Court · Supabase PostgreSQL Schema & Row Level Security (RLS)
-- Copy and paste this entire script into your Supabase Dashboard -> SQL Editor -> Run.

-- 1. Player Profiles (stores player settings & contact info per authenticated user)
create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  display_name text not null default 'Openline Player',
  email text not null default '',
  phone text not null default '',
  photo_url text not null default '',
  skill_level text not null default '3.5',
  dominant_hand text not null default 'Right' check (dominant_hand in ('Right', 'Left')),
  preferred_court_id text not null default 'court-1' check (preferred_court_id in ('court-1', 'court-2')),
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Bookings (court reservations, status, GCash payment state, check-in code & match score)
create table if not exists public.bookings (
  booking_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  court_id text not null check (court_id in ('court-1', 'court-2')),
  court_name text not null,
  date text not null,
  start_hour integer not null,
  duration_hours integer not null check (duration_hours in (1, 2)),
  match_format text not null check (match_format in ('singles', 'doubles', 'drills')),
  partner_names text not null default '',
  paddle_rental boolean not null default false,
  hourly_rate integer not null,
  total_amount integer not null,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'pending', 'current', 'completed', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  payment_method text not null default '',
  gcash_reference_no text not null default '',
  gcash_sender_number text not null default '',
  receipt_number text not null default '',
  paid_at_iso text not null default '',
  check_in_code text not null,
  checked_in boolean not null default false,
  score_summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Transactions (official GCash payment receipts)
create table if not exists public.transactions (
  tx_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  booking_id text not null references public.bookings(booking_id) on delete cascade,
  receipt_number text not null,
  court_id text not null check (court_id in ('court-1', 'court-2')),
  court_name text not null,
  date text not null,
  start_hour integer not null,
  duration_hours integer not null check (duration_hours in (1, 2)),
  match_format text not null check (match_format in ('singles', 'doubles', 'drills')),
  amount integer not null,
  payment_method text not null default 'GCash',
  gcash_account_name text not null,
  gcash_account_number text not null,
  gcash_reference_no text not null,
  gcash_sender_number text not null,
  payment_status text not null default 'paid',
  schedule_status_at_pay text not null check (schedule_status_at_pay in ('current', 'pending')),
  check_in_code text not null,
  created_at timestamptz not null default now()
);

-- 4. Court Slots (prevents double-booking of court_id + date + hour)
create table if not exists public.court_slots (
  slot_key text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  booking_id text not null references public.bookings(booking_id) on delete cascade,
  court_id text not null check (court_id in ('court-1', 'court-2')),
  date text not null,
  hour integer not null,
  start_hour integer not null,
  duration_hours integer not null check (duration_hours in (1, 2)),
  status text not null default 'reserved',
  created_at timestamptz not null default now()
);

-- 5. Court Schedules (live Current & Next schedule board)
create table if not exists public.court_schedules (
  schedule_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  booking_id text not null references public.bookings(booking_id) on delete cascade,
  player_display_name text not null,
  court_id text not null check (court_id in ('court-1', 'court-2')),
  court_name text not null,
  date text not null,
  start_hour integer not null,
  duration_hours integer not null check (duration_hours in (1, 2)),
  match_format text not null check (match_format in ('singles', 'doubles', 'drills')),
  status text not null check (status in ('current', 'pending', 'completed')),
  is_active boolean not null default true,
  checked_in boolean not null default false,
  score_summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_bookings_user_id on public.bookings(user_id);
create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_court_slots_date on public.court_slots(court_id, date);
create index if not exists idx_court_schedules_active on public.court_schedules(is_active, date);

-- Automatic updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_player_profiles_updated_at on public.player_profiles;
create trigger trg_player_profiles_updated_at
  before update on public.player_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_bookings_updated_at on public.bookings;
create trigger trg_bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_court_schedules_updated_at on public.court_schedules;
create trigger trg_court_schedules_updated_at
  before update on public.court_schedules
  for each row execute function public.set_updated_at();

-- Enable Row Level Security on all tables
alter table public.player_profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.transactions enable row level security;
alter table public.court_slots enable row level security;
alter table public.court_schedules enable row level security;

-- RLS Policies: player_profiles (strictly belongs to authenticated owner)
drop policy if exists "Users can view own profile" on public.player_profiles;
create policy "Users can view own profile"
  on public.player_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own profile" on public.player_profiles;
create policy "Users can insert own profile"
  on public.player_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own profile" on public.player_profiles;
create policy "Users can update own profile"
  on public.player_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own profile" on public.player_profiles;
create policy "Users can delete own profile"
  on public.player_profiles for delete
  using (auth.uid() = user_id);

-- RLS Policies: bookings (strictly belongs to authenticated owner)
drop policy if exists "Users can view own bookings" on public.bookings;
create policy "Users can view own bookings"
  on public.bookings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own bookings" on public.bookings;
create policy "Users can insert own bookings"
  on public.bookings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own bookings" on public.bookings;
create policy "Users can update own bookings"
  on public.bookings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own bookings" on public.bookings;
create policy "Users can delete own bookings"
  on public.bookings for delete
  using (auth.uid() = user_id);

-- RLS Policies: transactions (strictly belongs to authenticated owner)
drop policy if exists "Users can view own transactions" on public.transactions;
create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- RLS Policies: court_slots (all signed-in players can view reserved slots; writes belong to owner)
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'court_slots'
  loop
    execute format('drop policy if exists %I on public.court_slots', pol.policyname);
  end loop;
end $$;

create policy "Authenticated users can view court slots"
  on public.court_slots for select
  to authenticated
  using (true);

create policy "Users can insert own court slots"
  on public.court_slots for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own court slots"
  on public.court_slots for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own court slots"
  on public.court_slots for delete
  to authenticated
  using (auth.uid() = user_id);

-- RLS Policies: court_schedules (all signed-in players can view Current & Next Schedules; writes belong to owner)
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'court_schedules'
  loop
    execute format('drop policy if exists %I on public.court_schedules', pol.policyname);
  end loop;
end $$;

create policy "Authenticated users can view court schedules"
  on public.court_schedules for select
  to authenticated
  using (true);

create policy "Users can insert own court schedules"
  on public.court_schedules for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own court schedules"
  on public.court_schedules for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own court schedules"
  on public.court_schedules for delete
  to authenticated
  using (auth.uid() = user_id);

-- Enable Realtime broadcasts so all users & devices see Current & Next Schedules immediately
alter table public.bookings replica identity full;
alter table public.transactions replica identity full;
alter table public.court_slots replica identity full;
alter table public.court_schedules replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.bookings;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.transactions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.court_slots;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.court_schedules;
exception when duplicate_object then null;
end $$;
