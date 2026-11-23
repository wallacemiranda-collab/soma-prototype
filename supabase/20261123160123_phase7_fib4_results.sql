-- Fase 7 preview: physician-only FIB-4, with explicit patient sharing.
-- Apply after the Phase 8 audited access-log migration.

do $$
declare item record;
begin
  for item in
    select conname
    from pg_catalog.pg_constraint
    where conrelid = 'public.patient_access_logs'::regclass
      and contype = 'c'
      and pg_catalog.pg_get_constraintdef(oid) like '%scopes <@%'
  loop
    execute pg_catalog.format(
      'alter table public.patient_access_logs drop constraint %I', item.conname
    );
  end loop;
end;
$$;

alter table public.patient_access_logs
  add constraint patient_access_logs_scopes_allowed
  check (scopes <@ array['profile','measurements','habits','clinical','calculators']::text[]);

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
    or p_scope not in ('profile','measurements','habits','clinical','calculators') then
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

create table if not exists public.calculator_results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  calculator_key text not null check (calculator_key ~ '^[a-z0-9_-]{2,64}$'),
  calculator_type text not null check (calculator_type in ('patient','professional')),
  test_date date not null,
  inputs jsonb not null check (pg_catalog.jsonb_typeof(inputs) = 'object'),
  result jsonb not null check (pg_catalog.jsonb_typeof(result) = 'object'),
  shared_with_patient boolean not null default false,
  shared_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (shared_with_patient = (shared_at is not null and revoked_at is null))
);
create index if not exists calculator_results_patient_history_idx
  on public.calculator_results (patient_id, created_at desc, id desc);

alter table public.calculator_results enable row level security;
revoke all on public.calculator_results from public, anon, authenticated;
drop policy if exists "Calculator results require audited RPCs" on public.calculator_results;
create policy "Calculator results require audited RPCs" on public.calculator_results
  for select to authenticated using (false);

create or replace function endo_private.calculate_fib4(
  p_age_years integer,
  p_ast_u_l numeric,
  p_alt_u_l numeric,
  p_platelets_10e9_l numeric
)
returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  fib4 numeric;
  low_cutoff numeric := case when p_age_years >= 65 then 2.0 else 1.3 end;
  category text;
begin
  if p_age_years is null or p_age_years < 18 or p_age_years > 120
    or p_ast_u_l is null or p_ast_u_l < 1 or p_ast_u_l > 1000
    or p_alt_u_l is null or p_alt_u_l < 1 or p_alt_u_l > 1000
    or p_platelets_10e9_l is null or p_platelets_10e9_l < 10 or p_platelets_10e9_l > 1000 then
    raise exception 'Invalid FIB-4 inputs' using errcode = '22023';
  end if;

  fib4 := (p_age_years::numeric * p_ast_u_l) /
    (p_platelets_10e9_l * pg_catalog.sqrt(p_alt_u_l::double precision)::numeric);
  category := case
    when p_age_years < 35 then 'age_limited'
    when fib4 < low_cutoff then 'low'
    when fib4 <= 2.67 then 'intermediate'
    else 'high'
  end;
  return pg_catalog.jsonb_build_object(
    'score', pg_catalog.round(fib4, 2),
    'category', category,
    'low_cutoff', low_cutoff,
    'high_cutoff', 2.67,
    'age_limited', p_age_years < 35
  );
end;
$$;

create or replace function endo_private.save_fib4_result(
  p_patient_id uuid,
  p_access_request_id uuid,
  p_age_years integer,
  p_ast_u_l numeric,
  p_alt_u_l numeric,
  p_platelets_10e9_l numeric,
  p_test_date date
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  result_value jsonb;
  saved public.calculator_results;
  profile_birth_date date;
begin
  if actor is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if p_patient_id is null or p_access_request_id is null or p_test_date is null
    or p_test_date > current_date then
    raise exception 'Invalid FIB-4 record' using errcode = '22023';
  end if;
  if actor = p_patient_id or not endo_private.can_read_patient(p_patient_id)
    or not exists (
      select 1 from public.doctor_profiles d
      where d.user_id = actor and d.council = 'CRM'
    ) then
    raise insufficient_privilege using message = 'Authorized physician access required';
  end if;
  select p.birth_date into profile_birth_date
    from public.profiles p where p.id = p_patient_id;
  if profile_birth_date is not null and (
    p_test_date < profile_birth_date
    or p_age_years <> extract(year from age(p_test_date, profile_birth_date))::integer
  ) then
    raise exception 'Age does not match patient profile on exam date'
      using errcode = '22023';
  end if;

  result_value := endo_private.calculate_fib4(
    p_age_years, p_ast_u_l, p_alt_u_l, p_platelets_10e9_l
  );
  perform endo_private.record_patient_access(
    p_patient_id, p_access_request_id, 'calculators'
  );
  insert into public.calculator_results (
    patient_id, created_by, calculator_key, calculator_type,
    test_date, inputs, result
  ) values (
    p_patient_id, actor, 'fib4', 'professional', p_test_date,
    pg_catalog.jsonb_build_object(
      'age_years', p_age_years,
      'ast_u_l', p_ast_u_l,
      'alt_u_l', p_alt_u_l,
      'platelets_10e9_l', p_platelets_10e9_l
    ),
    result_value
  ) returning * into saved;
  return pg_catalog.to_jsonb(saved);
end;
$$;

create or replace function endo_private.doctor_calculator_results(
  p_patient_id uuid,
  p_offset integer,
  p_limit integer,
  p_access_request_id uuid
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  result_value jsonb;
begin
  if actor is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if p_patient_id is null or p_access_request_id is null
    or p_offset is null or p_offset < 0 or p_offset > 10000000
    or p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid calculator history page' using errcode = '22023';
  end if;
  if actor = p_patient_id or not endo_private.can_read_patient(p_patient_id)
    or not exists (
      select 1 from public.doctor_profiles d
      where d.user_id = actor and d.council = 'CRM'
    ) then
    raise insufficient_privilege using message = 'Authorized physician access required';
  end if;
  perform endo_private.record_patient_access(
    p_patient_id, p_access_request_id, 'calculators'
  );
  select coalesce(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(page_row)
      order by page_row.created_at desc, page_row.id desc),
    '[]'::jsonb
  ) into result_value
  from (
    select r.id, r.patient_id, r.calculator_key, r.calculator_type,
      r.test_date, r.inputs, r.result, r.shared_with_patient,
      r.shared_at, r.revoked_at, r.created_at
    from public.calculator_results r
    where r.patient_id = p_patient_id
      and r.calculator_type = 'professional'
      and r.created_by = actor
    order by r.created_at desc, r.id desc
    offset p_offset limit p_limit
  ) page_row;
  return result_value;
end;
$$;

create or replace function endo_private.patient_calculator_results(
  p_offset integer,
  p_limit integer
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  result_value jsonb;
begin
  if actor is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if p_offset is null or p_offset < 0 or p_offset > 10000000
    or p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid calculator history page' using errcode = '22023';
  end if;
  select coalesce(
    pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', page_row.id,
      'calculator_key', page_row.calculator_key,
      'result', page_row.result,
      'test_date', page_row.test_date,
      'shared_at', page_row.shared_at,
      'created_at', page_row.created_at
    ) order by page_row.created_at desc, page_row.id desc),
    '[]'::jsonb
  ) into result_value
  from (
    select r.id, r.calculator_key, r.result, r.test_date, r.shared_at, r.created_at
    from public.calculator_results r
    where r.patient_id = actor and (
      r.calculator_type = 'patient' or
      (r.calculator_type = 'professional' and r.shared_with_patient and r.revoked_at is null)
    )
    order by r.created_at desc, r.id desc
    offset p_offset limit p_limit
  ) page_row;
  return result_value;
end;
$$;

create or replace function endo_private.set_calculator_result_visibility(
  p_result_id uuid,
  p_shared_with_patient boolean
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target public.calculator_results;
begin
  if actor is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if p_result_id is null or p_shared_with_patient is null then
    raise exception 'Invalid calculator visibility request' using errcode = '22023';
  end if;
  select * into target from public.calculator_results r
    where r.id = p_result_id for update;
  if not found then return null; end if;

  if actor = target.patient_id then
    if p_shared_with_patient then
      raise insufficient_privilege using message = 'Patients cannot publish a professional result';
    end if;
    update public.calculator_results r
      set shared_with_patient = false,
          revoked_at = case when r.shared_with_patient then now() else r.revoked_at end
      where r.id = p_result_id returning * into target;
  elsif actor = target.created_by and exists (
    select 1 from public.doctor_profiles d
    where d.user_id = actor and d.council = 'CRM'
  ) and endo_private.can_read_patient(target.patient_id) then
    update public.calculator_results r
      set shared_with_patient = p_shared_with_patient,
          shared_at = case when p_shared_with_patient then now() else r.shared_at end,
          revoked_at = case when p_shared_with_patient then null else now() end
      where r.id = p_result_id returning * into target;
  else
    raise insufficient_privilege using message = 'Authorized result owner required';
  end if;
  if actor = target.patient_id then
    return pg_catalog.jsonb_build_object(
      'id', target.id,
      'shared_with_patient', target.shared_with_patient
    );
  end if;
  return pg_catalog.to_jsonb(target);
end;
$$;

create or replace function public.endo_save_fib4_result(
  p_patient_id uuid,
  p_access_request_id uuid,
  p_age_years integer,
  p_ast_u_l numeric,
  p_alt_u_l numeric,
  p_platelets_10e9_l numeric,
  p_test_date date
)
returns jsonb language sql security invoker set search_path = '' as $$
  select endo_private.save_fib4_result(
    p_patient_id, p_access_request_id, p_age_years, p_ast_u_l,
    p_alt_u_l, p_platelets_10e9_l, p_test_date
  );
$$;

create or replace function public.endo_doctor_calculator_results(
  p_patient_id uuid, p_offset integer, p_limit integer, p_access_request_id uuid
)
returns jsonb language sql security invoker set search_path = '' as $$
  select endo_private.doctor_calculator_results(
    p_patient_id, p_offset, p_limit, p_access_request_id
  );
$$;

create or replace function public.endo_patient_calculator_results(
  p_offset integer default 0, p_limit integer default 100
)
returns jsonb language sql security invoker set search_path = '' as $$
  select endo_private.patient_calculator_results(p_offset, p_limit);
$$;

create or replace function public.endo_set_calculator_result_visibility(
  p_result_id uuid, p_shared_with_patient boolean
)
returns jsonb language sql security invoker set search_path = '' as $$
  select endo_private.set_calculator_result_visibility(
    p_result_id, p_shared_with_patient
  );
$$;

do $$
declare signature text;
begin
  foreach signature in array array[
    'endo_private.record_patient_access(uuid,uuid,text)',
    'endo_private.calculate_fib4(integer,numeric,numeric,numeric)',
    'endo_private.save_fib4_result(uuid,uuid,integer,numeric,numeric,numeric,date)',
    'endo_private.doctor_calculator_results(uuid,integer,integer,uuid)',
    'endo_private.patient_calculator_results(integer,integer)',
    'endo_private.set_calculator_result_visibility(uuid,boolean)',
    'public.endo_save_fib4_result(uuid,uuid,integer,numeric,numeric,numeric,date)',
    'public.endo_doctor_calculator_results(uuid,integer,integer,uuid)',
    'public.endo_patient_calculator_results(integer,integer)',
    'public.endo_set_calculator_result_visibility(uuid,boolean)'
  ] loop
    execute pg_catalog.format('revoke all on function %s from public, anon, authenticated', signature);
  end loop;
  foreach signature in array array[
    'endo_private.save_fib4_result(uuid,uuid,integer,numeric,numeric,numeric,date)',
    'endo_private.doctor_calculator_results(uuid,integer,integer,uuid)',
    'endo_private.patient_calculator_results(integer,integer)',
    'endo_private.set_calculator_result_visibility(uuid,boolean)'
  ] loop
    execute pg_catalog.format('grant execute on function %s to authenticated', signature);
  end loop;
  foreach signature in array array[
    'public.endo_save_fib4_result(uuid,uuid,integer,numeric,numeric,numeric,date)',
    'public.endo_doctor_calculator_results(uuid,integer,integer,uuid)',
    'public.endo_patient_calculator_results(integer,integer)',
    'public.endo_set_calculator_result_visibility(uuid,boolean)'
  ] loop
    execute pg_catalog.format('grant execute on function %s to authenticated', signature);
  end loop;
end;
$$;
