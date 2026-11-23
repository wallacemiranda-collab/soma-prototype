-- Phase 8 preview: audit professional reads and remove unaudited direct reads.
-- Apply only after the current sharing and clinical schema migrations.
create table if not exists public.patient_access_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  doctor_id uuid not null,
  professional_name text not null,
  profession text not null,
  council text not null,
  registration text not null,
  registration_state text not null,
  access_request_id uuid not null,
  accessed_at timestamptz not null default now(),
  scopes text[] not null default '{}',
  check (cardinality(scopes) > 0),
  check (array_position(scopes, null) is null),
  check (scopes <@ array['profile','measurements','habits','clinical']::text[])
);
create index if not exists patient_access_logs_patient_time_idx
  on public.patient_access_logs (patient_id, accessed_at desc, id desc);
create index if not exists patient_access_logs_request_idx
  on public.patient_access_logs (patient_id, doctor_id, access_request_id, accessed_at desc);

alter table public.patient_access_logs enable row level security;
revoke all on public.patient_access_logs from public, anon, authenticated;
grant select on public.patient_access_logs to authenticated;
drop policy if exists "Patients read their access history" on public.patient_access_logs;
create policy "Patients read their access history" on public.patient_access_logs
  for select to authenticated using (patient_id = (select auth.uid()));

create or replace function endo_private.record_patient_access(
  p_patient_id uuid,
  p_access_request_id uuid,
  p_scope text
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  existing_id uuid;
begin
  if actor is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if p_patient_id is null or p_access_request_id is null
    or p_scope is null
    or p_scope not in ('profile','measurements','habits','clinical') then
    raise exception 'Invalid access event' using errcode = '22023';
  end if;
  if actor = p_patient_id then return; end if;
  if not endo_private.can_read_patient(p_patient_id) then
    raise insufficient_privilege using message = 'Patient authorization required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_patient_id::text || ':' || actor::text || ':' || p_access_request_id::text,
      0
    )
  );
  select l.id into existing_id
    from public.patient_access_logs l
    where l.patient_id = p_patient_id and l.doctor_id = actor
      and l.access_request_id = p_access_request_id
      and l.accessed_at >= now() - interval '5 minutes'
    order by l.accessed_at desc, l.id desc
    limit 1
    for update;
  if existing_id is not null then
    update public.patient_access_logs l
      set scopes = (
        select array_agg(scope order by scope)
        from (
          select distinct unnest(l.scopes || array[p_scope]) as scope
        ) scopes
      )
      where l.id = existing_id;
    return;
  end if;

  insert into public.patient_access_logs
    (patient_id, doctor_id, professional_name, profession, council,
      registration, registration_state, access_request_id, scopes)
  select p_patient_id, actor, d.professional_name, d.profession, d.council,
    d.crm, d.crm_state, p_access_request_id, array[p_scope]
  from public.doctor_profiles d where d.user_id = actor;
end;
$$;

-- One request ID groups all pages fetched while opening one patient record.
create or replace function endo_private.audited_patient_page(
  p_patient_id uuid,
  p_resource text,
  p_offset integer,
  p_limit integer,
  p_access_request_id uuid
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  resource_table text;
  owner_column text;
  order_column text;
  scope_name text;
  statement text;
  result jsonb;
begin
  if actor is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if p_patient_id is null or p_access_request_id is null
    or p_offset is null or p_offset < 0 or p_offset > 10000000
    or p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'Invalid page request' using errcode = '22023';
  end if;
  if actor = p_patient_id then
    raise insufficient_privilege using message = 'Use patient-owned reads';
  end if;
  if not endo_private.can_read_patient(p_patient_id) then
    raise insufficient_privilege using message = 'Patient authorization required';
  end if;

  case p_resource
    when 'profile' then
      perform endo_private.record_patient_access(p_patient_id, p_access_request_id, 'profile');
      select coalesce(jsonb_agg(to_jsonb(profile_row)), '[]'::jsonb)
        into result
        from (
          select p.id, coalesce(p.full_name, 'Paciente') as full_name,
            p.birth_date, p.sex, p.goal_weight, p.weekly_exercise_goal,
            p.sleep_goal_hours
          from public.profiles p where p.id = p_patient_id
        ) profile_row;
      return result;
    when 'entries' then
      resource_table := 'metabolic_entries';
      owner_column := 'user_id';
      order_column := 'entry_date';
      scope_name := 'measurements';
    when 'habits' then
      resource_table := 'habit_logs';
      owner_column := 'user_id';
      order_column := 'logged_at';
      scope_name := 'habits';
    else
      raise exception 'Unknown patient data resource' using errcode = '22023';
  end case;

  perform endo_private.record_patient_access(p_patient_id, p_access_request_id, scope_name);
  statement := format(
    'select coalesce(jsonb_agg(to_jsonb(page_row) order by page_row.%I desc, page_row.id desc), ''[]''::jsonb) ' ||
    'from (select * from public.%I where %I = $1 order by %I desc, id desc offset $2 limit $3) page_row',
    order_column, resource_table, owner_column, order_column
  );
  execute statement into result using p_patient_id, p_offset, p_limit;
  return coalesce(result, '[]'::jsonb);
end;
$$;

create or replace function endo_private.audited_clinical_page(
  p_patient_id uuid,
  p_resource text,
  p_offset integer,
  p_limit integer,
  p_access_request_id uuid
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  resource_table text;
  order_column text;
  row_filter text;
  statement text;
  result jsonb;
begin
  if actor is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if p_patient_id is null or p_access_request_id is null
    or p_offset is null or p_offset < 0 or p_offset > 10000000
    or p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'Invalid page request' using errcode = '22023';
  end if;
  if actor = p_patient_id or not endo_private.can_read_patient(p_patient_id) then
    raise insufficient_privilege using message = 'Patient authorization required';
  end if;
  case p_resource
    when 'clinical_module_versions' then
      resource_table := 'clinical_module_versions';
      order_column := 'created_at';
      row_filter := 't.patient_id = $1 and exists (select 1 from public.clinical_module_settings s where s.patient_id = t.patient_id and s.module_key = t.module_key and endo_private.clinical_active(s.id))';
    when 'clinical_record_corrections' then
      resource_table := 'clinical_record_corrections';
      order_column := 'created_at';
      row_filter := 't.patient_id = $1 and exists (select 1 from public.clinical_module_settings s where s.patient_id = t.patient_id and s.module_key = case t.kind when ''glucose'' then ''diabetes'' when ''hypoglycemia'' then ''diabetes'' when ''hba1c'' then ''diabetes'' when ''injection'' then ''glp1'' when ''gi'' then ''glp1'' when ''thyroid'' then ''thyroid'' when ''pressure'' then ''pressure'' end and endo_private.clinical_active(s.id))';
    when 'glucose_readings' then
      resource_table := 'glucose_readings'; order_column := 'occurred_at';
    when 'hypoglycemia_events' then
      resource_table := 'hypoglycemia_events'; order_column := 'occurred_at';
    when 'hba1c_results' then
      resource_table := 'hba1c_results'; order_column := 'occurred_on';
    when 'injection_logs' then
      resource_table := 'injection_logs'; order_column := 'occurred_at';
    when 'gi_symptom_logs' then
      resource_table := 'gi_symptom_logs'; order_column := 'occurred_at';
    when 'thyroid_intakes' then
      resource_table := 'thyroid_intakes'; order_column := 'occurred_at';
    when 'blood_pressure_readings' then
      resource_table := 'blood_pressure_readings'; order_column := 'occurred_at';
    else
      raise exception 'Unknown clinical data resource' using errcode = '22023';
  end case;

  if row_filter is null then
    row_filter := 't.patient_id = $1 and exists (select 1 from public.clinical_module_settings s where s.patient_id = t.patient_id and s.module_key = t.module_key and endo_private.clinical_active(s.id))';
  end if;
  perform endo_private.record_patient_access(p_patient_id, p_access_request_id, 'clinical');
  statement := format(
    'select coalesce(jsonb_agg(to_jsonb(page_row) order by page_row.%I desc, page_row.id desc), ''[]''::jsonb) ' ||
    'from (select t.* from public.%I t where %s order by t.%I desc, t.id desc offset $2 limit $3) page_row',
    order_column, resource_table, row_filter, order_column
  );
  execute statement into result using p_patient_id, p_offset, p_limit;
  return coalesce(result, '[]'::jsonb);
end;
$$;

create or replace function endo_private.clinical_overview(p_patient uuid, p_access_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (auth.uid() = p_patient or endo_private.can_read_patient(p_patient)) then
    raise insufficient_privilege using message = 'Patient authorization required';
  end if;
  if auth.uid() is distinct from p_patient then
    perform endo_private.record_patient_access(p_patient, p_access_request_id, 'clinical');
  end if;
  return jsonb_build_object(
    'modules', coalesce((
      select jsonb_agg(
        to_jsonb(s) || jsonb_build_object('active', endo_private.clinical_active(s.id), 'version', to_jsonb(v))
        order by s.module_key
      )
      from public.clinical_module_settings s
      left join public.clinical_module_versions v on v.id = s.current_version_id
      where s.patient_id = p_patient
        and (auth.uid() = p_patient or endo_private.clinical_active(s.id))
    ), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.granted_at desc)
      from public.patient_module_permissions p
      where p.patient_id = p_patient and (p_patient = auth.uid() or p.doctor_id = auth.uid())
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function endo_private.clinical_overview(p_patient uuid)
returns jsonb
language sql security definer set search_path = '' as $$
  select endo_private.clinical_overview(p_patient, gen_random_uuid());
$$;

create or replace function endo_private.shared_profile(p_patient_id uuid)
returns table (id uuid, full_name text, birth_date date, sex text, goal_weight numeric, weekly_exercise_goal integer, sleep_goal_hours numeric)
language plpgsql security definer set search_path = '' as $$
begin
  if not endo_private.can_read_patient(p_patient_id) then
    raise insufficient_privilege using message = 'Patient authorization required';
  end if;
  perform endo_private.record_patient_access(p_patient_id, gen_random_uuid(), 'profile');
  return query select p.id, coalesce(p.full_name, 'Paciente'), p.birth_date, p.sex,
    p.goal_weight, p.weekly_exercise_goal, p.sleep_goal_hours
    from public.profiles p where p.id = p_patient_id;
end;
$$;

create or replace function endo_private.patient_access_history(p_limit integer, p_offset integer)
returns table (
  id uuid,
  professional_name text,
  profession text,
  council text,
  crm text,
  crm_state text,
  accessed_at timestamptz,
  scopes text[]
)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  return query
    select l.id, l.professional_name, l.profession, l.council, l.registration,
      l.registration_state, l.accessed_at, l.scopes
    from public.patient_access_logs l
    where l.patient_id = auth.uid()
    order by l.accessed_at desc, l.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
    offset least(greatest(coalesce(p_offset, 0), 0), 10000000);
end;
$$;

create or replace function public.endo_audited_patient_page(
  p_patient_id uuid, p_resource text, p_offset integer, p_limit integer, p_access_request_id uuid
)
returns jsonb language sql security invoker set search_path = '' as $$
  select endo_private.audited_patient_page(p_patient_id, p_resource, p_offset, p_limit, p_access_request_id);
$$;
create or replace function public.endo_doctor_clinical_page(
  p_patient_id uuid, p_resource text, p_offset integer, p_limit integer, p_access_request_id uuid
)
returns jsonb language sql security invoker set search_path = '' as $$
  select endo_private.audited_clinical_page(p_patient_id, p_resource, p_offset, p_limit, p_access_request_id);
$$;
create or replace function public.endo_audited_clinical_overview(
  p_patient_id uuid, p_access_request_id uuid
)
returns jsonb language sql security invoker set search_path = '' as $$
  select endo_private.clinical_overview(p_patient_id, p_access_request_id);
$$;
create or replace function public.endo_patient_access_history(
  p_limit integer default 50, p_offset integer default 0
)
returns table (
  id uuid, professional_name text, profession text, council text,
  crm text, crm_state text, accessed_at timestamptz, scopes text[]
)
language sql security invoker set search_path = '' as $$
  select * from endo_private.patient_access_history(p_limit, p_offset);
$$;
create or replace function public.endo_shared_profile(p_patient_id uuid)
returns table (id uuid, full_name text, birth_date date, sex text, goal_weight numeric, weekly_exercise_goal integer, sleep_goal_hours numeric)
language sql security invoker set search_path = '' as $$
  select * from endo_private.shared_profile(p_patient_id);
$$;
create or replace function public.endo_clinical_overview(p_patient_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select endo_private.clinical_overview(p_patient_id);
$$;

-- Direct PostgREST reads cannot be audited; patients retain their own RLS policies.
drop policy if exists "Authorized doctors read shared measurements" on public.metabolic_entries;
drop policy if exists "Authorized doctors read shared habits" on public.habit_logs;

do $$
declare t text;
begin
  foreach t in array array[
    'patient_module_permissions','clinical_module_settings','clinical_module_versions',
    'glucose_readings','hypoglycemia_events','hba1c_results','injection_logs',
    'gi_symptom_logs','thyroid_intakes','blood_pressure_readings'
  ] loop
    execute format('drop policy if exists clinical_doctor_read on public.%I', t);
    execute format('drop policy if exists clinical_shared_read on public.%I', t);
  end loop;
end;
$$;
drop policy if exists clinical_corrections_shared_read on public.clinical_record_corrections;

do $$
declare signature text;
begin
  foreach signature in array array[
    'endo_private.record_patient_access(uuid,uuid,text)',
    'endo_private.audited_patient_page(uuid,text,integer,integer,uuid)',
    'endo_private.audited_clinical_page(uuid,text,integer,integer,uuid)',
    'endo_private.clinical_overview(uuid)',
    'endo_private.clinical_overview(uuid,uuid)',
    'endo_private.shared_profile(uuid)',
    'endo_private.patient_access_history(integer,integer)',
    'public.endo_audited_patient_page(uuid,text,integer,integer,uuid)',
    'public.endo_doctor_clinical_page(uuid,text,integer,integer,uuid)',
    'public.endo_audited_clinical_overview(uuid,uuid)',
    'public.endo_patient_access_history(integer,integer)',
    'public.endo_shared_profile(uuid)',
    'public.endo_clinical_overview(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to authenticated', signature);
  end loop;
end;
$$;
