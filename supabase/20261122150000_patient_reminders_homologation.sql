-- Apply only to the empty synthetic homologation project.
do $$
begin
  if coalesce(public.endo_homologation_info()->>'project_id', '')
       <> 'ctcsolobseerqnddahun'
     or coalesce(public.endo_homologation_info()->>'environment', '')
       <> 'homologation'
     or coalesce((public.endo_homologation_info()->>'synthetic_only')::boolean, false)
       is not true then
    raise exception 'Patient reminders are restricted to synthetic homologation.';
  end if;
end;
$$;

create table public.patient_reminder_preferences (
  patient_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  time_zone text not null default 'America/Sao_Paulo'
    check (char_length(time_zone) between 1 and 80),
  quiet_hours_enabled boolean not null default true,
  quiet_start time not null default time '22:00',
  quiet_end time not null default time '08:00',
  consent_version text not null
    check (consent_version = 'endo-reminders-homologation-v1'),
  consented_at timestamptz not null,
  consent_revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint patient_reminder_quiet_hours_differ
    check (not quiet_hours_enabled or quiet_start <> quiet_end),
  constraint patient_reminder_revoked_is_disabled
    check (consent_revoked_at is null or enabled = false)
);

create table public.patient_reminder_rules (
  patient_id uuid not null
    references public.patient_reminder_preferences(patient_id) on delete cascade,
  kind text not null
    check (kind in ('medication', 'application', 'weight', 'daily')),
  enabled boolean not null default false,
  reminder_time time not null,
  weekday smallint,
  updated_at timestamptz not null default now(),
  primary key (patient_id, kind),
  constraint patient_reminder_rule_frequency check (
    (kind in ('application', 'weight') and weekday is not null and weekday between 0 and 6)
    or (kind in ('medication', 'daily') and weekday is null)
  )
);

alter table public.patient_reminder_preferences enable row level security;
alter table public.patient_reminder_rules enable row level security;

create policy "Synthetic patients read their own reminder preferences"
  on public.patient_reminder_preferences for select to authenticated
  using (
    auth.uid() = patient_id
    and coalesce(auth.jwt()->>'email', '')
      ~* '^endo-[0-9a-f]{16}-(patient|otherpatient)@example\.invalid$'
  );

create policy "Synthetic patients read their own reminder rules"
  on public.patient_reminder_rules for select to authenticated
  using (
    auth.uid() = patient_id
    and coalesce(auth.jwt()->>'email', '')
      ~* '^endo-[0-9a-f]{16}-(patient|otherpatient)@example\.invalid$'
  );

revoke all on public.patient_reminder_preferences,
  public.patient_reminder_rules from public, anon, authenticated;
grant select on public.patient_reminder_preferences,
  public.patient_reminder_rules to authenticated;

create or replace function public.endo_save_patient_reminder_schedule(
  p_schedule jsonb,
  p_consent_accepted boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid := auth.uid();
  v_email text := coalesce(auth.jwt()->>'email', '');
  v_enabled boolean;
  v_time_zone text;
  v_quiet_enabled boolean;
  v_quiet_start time;
  v_quiet_end time;
  v_rule jsonb;
  v_kind text;
  v_time text;
  v_weekday text;
  v_enabled_rules integer := 0;
begin
  if v_patient_id is null
     or v_email !~* '^endo-[0-9a-f]{16}-(patient|otherpatient)@example\.invalid$' then
    raise exception 'Synthetic patient account required.' using errcode = '42501';
  end if;
  if p_consent_accepted is distinct from true then
    raise exception 'Patient consent is required.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_schedule) is distinct from 'object'
     or jsonb_typeof(p_schedule->'enabled') is distinct from 'boolean'
     or jsonb_typeof(p_schedule->'quiet') is distinct from 'object'
     or jsonb_typeof(p_schedule->'quiet'->'enabled') is distinct from 'boolean'
     or jsonb_typeof(p_schedule->'rules') is distinct from 'array' then
    raise exception 'Invalid reminder schedule.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_schedule->'rules') <> 4 then
    raise exception 'Invalid reminder schedule.' using errcode = '22023';
  end if;

  v_enabled := (p_schedule->>'enabled')::boolean;
  v_time_zone := p_schedule->>'timeZone';
  v_quiet_enabled := (p_schedule->'quiet'->>'enabled')::boolean;
  if v_time_zone is null or char_length(v_time_zone) > 80
     or not exists (
       select 1 from pg_catalog.pg_timezone_names where name = v_time_zone
     ) then
    raise exception 'Invalid time zone.' using errcode = '22023';
  end if;

  if coalesce(p_schedule->'quiet'->>'start', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or coalesce(p_schedule->'quiet'->>'end', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Invalid quiet hours.' using errcode = '22023';
  end if;
  v_quiet_start := (p_schedule->'quiet'->>'start')::time;
  v_quiet_end := (p_schedule->'quiet'->>'end')::time;
  if v_quiet_enabled and v_quiet_start = v_quiet_end then
    raise exception 'Quiet hours must differ.' using errcode = '22023';
  end if;

  for v_rule in select value from jsonb_array_elements(p_schedule->'rules')
  loop
    if jsonb_typeof(v_rule) is distinct from 'object'
       or jsonb_typeof(v_rule->'enabled') is distinct from 'boolean' then
      raise exception 'Invalid reminder rule.' using errcode = '22023';
    end if;
    v_kind := v_rule->>'id';
    v_time := v_rule->>'time';
    v_weekday := v_rule->>'weekday';
    if coalesce(v_kind, '') not in ('medication', 'application', 'weight', 'daily')
       or coalesce(v_time, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'Invalid reminder rule.' using errcode = '22023';
    end if;
    if v_kind in ('application', 'weight') then
      if coalesce(v_weekday, '') !~ '^[0-6]$' then
        raise exception 'Invalid weekly reminder day.' using errcode = '22023';
      end if;
    elsif coalesce(v_rule->'weekday', 'null'::jsonb) is distinct from 'null'::jsonb then
      raise exception 'Daily reminders cannot specify a weekday.' using errcode = '22023';
    end if;
    if (v_rule->>'enabled')::boolean then
      v_enabled_rules := v_enabled_rules + 1;
    end if;
  end loop;
  if (
    select count(distinct value->>'id')
    from jsonb_array_elements(p_schedule->'rules')
  ) <> 4 then
    raise exception 'Duplicate reminder rule.' using errcode = '22023';
  end if;
  if v_enabled and v_enabled_rules = 0 then
    raise exception 'Choose at least one reminder.' using errcode = '22023';
  end if;

  insert into public.patient_reminder_preferences (
    patient_id, enabled, time_zone, quiet_hours_enabled, quiet_start,
    quiet_end, consent_version, consented_at, consent_revoked_at, updated_at
  ) values (
    v_patient_id, v_enabled, v_time_zone, v_quiet_enabled, v_quiet_start,
    v_quiet_end, 'endo-reminders-homologation-v1', now(), null, now()
  )
  on conflict (patient_id) do update set
    enabled = excluded.enabled,
    time_zone = excluded.time_zone,
    quiet_hours_enabled = excluded.quiet_hours_enabled,
    quiet_start = excluded.quiet_start,
    quiet_end = excluded.quiet_end,
    consent_version = excluded.consent_version,
    consented_at = case
      when public.patient_reminder_preferences.consent_revoked_at is null
        then public.patient_reminder_preferences.consented_at
      else now()
    end,
    consent_revoked_at = null,
    updated_at = now();

  insert into public.patient_reminder_rules (
    patient_id, kind, enabled, reminder_time, weekday, updated_at
  )
  select
    v_patient_id,
    rule->>'id',
    (rule->>'enabled')::boolean,
    (rule->>'time')::time,
    case when rule->>'weekday' is null then null else (rule->>'weekday')::smallint end,
    now()
  from jsonb_array_elements(p_schedule->'rules') as entry(rule)
  on conflict (patient_id, kind) do update set
    enabled = excluded.enabled,
    reminder_time = excluded.reminder_time,
    weekday = excluded.weekday,
    updated_at = now();
end;
$$;

create or replace function public.endo_revoke_patient_reminder_schedule()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid := auth.uid();
  v_email text := coalesce(auth.jwt()->>'email', '');
begin
  if v_patient_id is null
     or v_email !~* '^endo-[0-9a-f]{16}-(patient|otherpatient)@example\.invalid$' then
    raise exception 'Synthetic patient account required.' using errcode = '42501';
  end if;
  update public.patient_reminder_preferences
  set enabled = false,
      time_zone = 'America/Sao_Paulo',
      quiet_hours_enabled = true,
      quiet_start = time '22:00',
      quiet_end = time '08:00',
      consent_revoked_at = now(),
      updated_at = now()
  where patient_id = v_patient_id;
  delete from public.patient_reminder_rules where patient_id = v_patient_id;
end;
$$;

revoke all on function public.endo_save_patient_reminder_schedule(jsonb, boolean)
  from public, anon, authenticated;
revoke all on function public.endo_revoke_patient_reminder_schedule()
  from public, anon, authenticated;
grant execute on function public.endo_save_patient_reminder_schedule(jsonb, boolean)
  to authenticated;
grant execute on function public.endo_revoke_patient_reminder_schedule()
  to authenticated;
