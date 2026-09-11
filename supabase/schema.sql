create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  goal_weight numeric,
  weekly_exercise_goal integer default 150,
  sleep_goal_hours numeric default 7,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.metabolic_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null default current_date,
  weight_kg numeric,
  waist_cm numeric,
  sleep_minutes integer,
  activity_minutes integer,
  water_liters numeric,
  mood_score integer check (mood_score between 1 and 10),
  nutrition_adherence integer check (nutrition_adherence between 0 and 100),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, entry_date)
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  logged_at date not null default current_date,
  habit_key text not null,
  value numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, logged_at, habit_key)
);

create index if not exists metabolic_entries_user_date_idx
  on public.metabolic_entries (user_id, entry_date desc);

create index if not exists habit_logs_user_date_idx
  on public.habit_logs (user_id, logged_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_metabolic_entries_updated_at on public.metabolic_entries;
create trigger set_metabolic_entries_updated_at
  before update on public.metabolic_entries
  for each row execute function public.set_updated_at();

drop trigger if exists set_habit_logs_updated_at on public.habit_logs;
create trigger set_habit_logs_updated_at
  before update on public.habit_logs
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.metabolic_entries enable row level security;
alter table public.habit_logs enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can read own metabolic entries" on public.metabolic_entries;
create policy "Users can read own metabolic entries"
  on public.metabolic_entries for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own metabolic entries" on public.metabolic_entries;
create policy "Users can insert own metabolic entries"
  on public.metabolic_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own metabolic entries" on public.metabolic_entries;
create policy "Users can update own metabolic entries"
  on public.metabolic_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own habit logs" on public.habit_logs;
create policy "Users can read own habit logs"
  on public.habit_logs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own habit logs" on public.habit_logs;
create policy "Users can insert own habit logs"
  on public.habit_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own habit logs" on public.habit_logs;
create policy "Users can update own habit logs"
  on public.habit_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
