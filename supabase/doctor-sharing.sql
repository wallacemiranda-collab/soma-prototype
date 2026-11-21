-- Patient-managed, read-only sharing. No existing patient is shared by default.
create schema if not exists endo_private;
revoke all on schema endo_private from public, anon;
grant usage on schema endo_private to authenticated;

create table if not exists public.doctor_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  professional_name text not null check (char_length(trim(professional_name)) between 2 and 100),
  crm text not null check (crm ~ '^[0-9]{1,10}$'),
  crm_state text not null check (crm_state in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  share_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
  created_at timestamptz not null default now()
);

create table if not exists public.patient_shares (
  patient_id uuid not null references public.profiles(id) on delete cascade,
  doctor_id uuid not null references public.doctor_profiles(user_id) on delete cascade,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  consent_version text not null default 'endo-sharing-v1',
  primary key (patient_id, doctor_id),
  check (patient_id <> doctor_id),
  check (expires_at is null or expires_at > granted_at)
);
create index if not exists patient_shares_doctor_idx on public.patient_shares (doctor_id, patient_id);

alter table public.doctor_profiles enable row level security;
alter table public.patient_shares enable row level security;
revoke all on public.doctor_profiles, public.patient_shares from public, anon, authenticated;
grant select on public.doctor_profiles, public.patient_shares to authenticated;
grant insert (user_id, professional_name, crm, crm_state) on public.doctor_profiles to authenticated;

create policy "Doctors read own registration" on public.doctor_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Doctors register their own identity" on public.doctor_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Participants read their sharing records" on public.patient_shares
  for select to authenticated using (
    patient_id = (select auth.uid()) or
    (doctor_id = (select auth.uid()) and revoked_at is null and (expires_at is null or expires_at > now()))
  );

-- Definers live outside the exposed schema and enforce the caller's identity.
-- They avoid recursive RLS and never authorize through editable user metadata.
create or replace function endo_private.can_read_patient(p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.patient_shares s
    where s.patient_id = p_patient_id and s.doctor_id = (select auth.uid())
      and s.revoked_at is null and (s.expires_at is null or s.expires_at > now())
  );
$$;

create or replace function endo_private.lookup_doctor(p_code text)
returns table (doctor_id uuid, professional_name text, crm text, crm_state text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  if p_code !~ '^[A-F0-9]{16}$' then return; end if;
  return query select d.user_id, d.professional_name, d.crm, d.crm_state
    from public.doctor_profiles d where d.share_code = p_code;
end;
$$;

create or replace function endo_private.my_doctors()
returns table (doctor_id uuid, professional_name text, crm text, crm_state text, granted_at timestamptz, expires_at timestamptz, revoked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.doctor_id, d.professional_name, d.crm, d.crm_state, s.granted_at, s.expires_at, s.revoked_at
  from public.patient_shares s join public.doctor_profiles d on d.user_id = s.doctor_id
  where s.patient_id = (select auth.uid()) order by s.granted_at desc;
$$;

create or replace function endo_private.my_patients()
returns table (patient_id uuid, full_name text, granted_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.patient_id, coalesce(p.full_name, 'Paciente'), s.granted_at, s.expires_at
  from public.patient_shares s join public.profiles p on p.id = s.patient_id
  where s.doctor_id = (select auth.uid()) and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > now())
  order by p.full_name, s.patient_id;
$$;

create or replace function endo_private.shared_profile(p_patient_id uuid)
returns table (id uuid, full_name text, birth_date date, sex text, goal_weight numeric, weekly_exercise_goal integer, sleep_goal_hours numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not endo_private.can_read_patient(p_patient_id) then
    raise insufficient_privilege using message = 'Patient authorization required';
  end if;
  return query select p.id, coalesce(p.full_name, 'Paciente'), p.birth_date, p.sex,
    p.goal_weight, p.weekly_exercise_goal, p.sleep_goal_hours
    from public.profiles p where p.id = p_patient_id;
end;
$$;

create or replace function endo_private.grant_doctor_access(p_doctor_id uuid, p_days integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  patient uuid := auth.uid();
begin
  if patient is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  if patient = p_doctor_id or not exists(select 1 from public.doctor_profiles d where d.user_id = p_doctor_id) then
    raise exception 'Invalid doctor' using errcode = '22023';
  end if;
  if p_days is not null and p_days not in (7,30,90) then
    raise exception 'Invalid sharing duration' using errcode = '22023';
  end if;
  insert into public.patient_shares (patient_id, doctor_id, granted_at, expires_at, revoked_at, consent_version)
  values (patient, p_doctor_id, now(), case when p_days is null then null else now() + make_interval(days => p_days) end, null, 'endo-sharing-v1')
  on conflict (patient_id, doctor_id) do update
    set granted_at = excluded.granted_at, expires_at = excluded.expires_at,
        revoked_at = null, consent_version = excluded.consent_version;
end;
$$;

create or replace function endo_private.revoke_doctor_access(p_doctor_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  update public.patient_shares set revoked_at = now()
    where patient_id = (select auth.uid()) and doctor_id = p_doctor_id and revoked_at is null;
end;
$$;

-- Exposed RPC wrappers use invoker rights. Emails and authentication data are never returned.
create or replace function public.endo_lookup_doctor(p_code text)
returns table (doctor_id uuid, professional_name text, crm text, crm_state text)
language sql stable security invoker set search_path = '' as $$ select * from endo_private.lookup_doctor(p_code); $$;
create or replace function public.endo_my_doctors()
returns table (doctor_id uuid, professional_name text, crm text, crm_state text, granted_at timestamptz, expires_at timestamptz, revoked_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from endo_private.my_doctors(); $$;
create or replace function public.endo_my_patients()
returns table (patient_id uuid, full_name text, granted_at timestamptz, expires_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from endo_private.my_patients(); $$;
create or replace function public.endo_shared_profile(p_patient_id uuid)
returns table (id uuid, full_name text, birth_date date, sex text, goal_weight numeric, weekly_exercise_goal integer, sleep_goal_hours numeric)
language sql stable security invoker set search_path = '' as $$ select * from endo_private.shared_profile(p_patient_id); $$;
create or replace function public.endo_can_read_patient(p_patient_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$ select endo_private.can_read_patient(p_patient_id); $$;
create or replace function public.endo_grant_doctor_access(p_doctor_id uuid, p_days integer default 30)
returns void language sql security invoker set search_path = '' as $$ select endo_private.grant_doctor_access(p_doctor_id, p_days); $$;
create or replace function public.endo_revoke_doctor_access(p_doctor_id uuid)
returns void language sql security invoker set search_path = '' as $$ select endo_private.revoke_doctor_access(p_doctor_id); $$;

do $$
declare signature text;
begin
  foreach signature in array array[
    'endo_private.can_read_patient(uuid)', 'endo_private.lookup_doctor(text)',
    'endo_private.my_doctors()', 'endo_private.my_patients()', 'endo_private.shared_profile(uuid)',
    'endo_private.grant_doctor_access(uuid,integer)', 'endo_private.revoke_doctor_access(uuid)',
    'public.endo_can_read_patient(uuid)', 'public.endo_lookup_doctor(text)',
    'public.endo_my_doctors()', 'public.endo_my_patients()', 'public.endo_shared_profile(uuid)',
    'public.endo_grant_doctor_access(uuid,integer)', 'public.endo_revoke_doctor_access(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to authenticated', signature);
  end loop;
end;
$$;

create policy "Authorized doctors read shared measurements" on public.metabolic_entries
  for select to authenticated using (endo_private.can_read_patient(user_id));
create policy "Authorized doctors read shared habits" on public.habit_logs
  for select to authenticated using (endo_private.can_read_patient(user_id));
