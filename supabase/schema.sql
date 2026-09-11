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
  created_at timestamptz default now()
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  logged_at date not null default current_date,
  habit_key text not null,
  value numeric,
  notes text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.metabolic_entries enable row level security;
alter table public.habit_logs enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can read own metabolic entries"
  on public.metabolic_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert own metabolic entries"
  on public.metabolic_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can read own habit logs"
  on public.habit_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own habit logs"
  on public.habit_logs for insert
  with check (auth.uid() = user_id);
