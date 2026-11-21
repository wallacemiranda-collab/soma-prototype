-- Add optional profile fields without changing existing patient records or RLS.
alter table public.profiles
  add column if not exists birth_date date
    constraint profiles_birth_date_check
    check (birth_date between date '0001-01-01' and current_date),
  add column if not exists sex text
    constraint profiles_sex_check
    check (sex in ('female', 'male', 'intersex', 'not_informed'));
