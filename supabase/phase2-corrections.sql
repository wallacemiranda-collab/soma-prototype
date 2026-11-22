-- Incremental: apply after phase2-clinical.sql, only in homologation until release approval.
create table public.clinical_record_corrections (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null check (actor_id = patient_id),
  kind text not null check (kind in ('glucose','hypoglycemia','hba1c','injection','gi','thyroid','pressure')),
  previous_record_id uuid not null,
  replacement_record_id uuid,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  check (previous_record_id is distinct from replacement_record_id),
  unique (patient_id, request_id),
  unique (kind, previous_record_id),
  unique (kind, replacement_record_id)
);
create index clinical_corrections_patient_history on public.clinical_record_corrections (patient_id,created_at desc,id desc);
alter table public.clinical_record_corrections enable row level security;
revoke all on public.clinical_record_corrections from public, anon, authenticated;
grant select on public.clinical_record_corrections to authenticated;
create policy clinical_corrections_patient_read on public.clinical_record_corrections for select to authenticated
  using (patient_id = (select auth.uid()));
create policy clinical_corrections_shared_read on public.clinical_record_corrections for select to authenticated
  using (endo_private.can_read_patient(patient_id));

create function endo_private.clinical_record_spec(p_kind text)
returns jsonb language plpgsql immutable security invoker set search_path = '' as $$
declare m text; t text; keys text[];
begin
  case p_kind
    when 'glucose' then m := 'diabetes'; t := 'glucose_readings'; keys := array['value','context'];
    when 'hypoglycemia' then m := 'diabetes'; t := 'hypoglycemia_events'; keys := array['value','symptoms','action_taken'];
    when 'hba1c' then m := 'diabetes'; t := 'hba1c_results'; keys := array['value'];
    when 'injection' then m := 'glp1'; t := 'injection_logs'; keys := array['site'];
    when 'gi' then m := 'glp1'; t := 'gi_symptom_logs'; keys := array['nausea','vomiting','constipation','diarrhea','reflux'];
    when 'thyroid' then m := 'thyroid'; t := 'thyroid_intakes'; keys := array['fasting'];
    when 'pressure' then m := 'pressure'; t := 'blood_pressure_readings'; keys := array['systolic','diastolic','pulse'];
    else raise exception 'Unknown record kind' using errcode = '22023';
  end case;
  return jsonb_build_object('module_key',m,'table_name',t,'keys',keys || array['time_zone',case when p_kind = 'hba1c' then 'occurred_on' else 'occurred_at' end]);
end $$;

create function endo_private.clinical_record_input(p_kind text,p_values jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare spec jsonb := endo_private.clinical_record_spec(p_kind); allowed text[]; key text; zone text;
begin
  select array_agg(value) into allowed from jsonb_array_elements_text(spec->'keys');
  perform endo_private.clinical_keys(p_values,allowed);
  foreach key in array allowed loop
    if key in ('value','systolic','diastolic','pulse','nausea','vomiting','constipation','diarrhea','reflux') then
      if jsonb_typeof(p_values->key) is distinct from 'number' and not (
        (key = 'pulse' or (key = 'value' and p_kind = 'hypoglycemia'))
        and (not p_values ? key or p_values->key = 'null'::jsonb)
      ) then raise exception 'Clinical numeric field must be a number' using errcode = '22023'; end if;
    elsif jsonb_typeof(p_values->key) is distinct from 'string' then
      raise exception 'Clinical text field must be a string' using errcode = '22023';
    end if;
  end loop;
  zone := p_values->>'time_zone';
  if not exists(select 1 from pg_catalog.pg_timezone_names where name = zone) then raise exception 'Invalid time zone' using errcode = '22023'; end if;
  if p_kind = 'hba1c' then
    if coalesce(p_values->>'occurred_on','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid exam date' using errcode = '22023'; end if;
    if (p_values->>'occurred_on')::date > (now() at time zone zone)::date then raise exception 'Future exam date' using errcode = '22023'; end if;
  elsif coalesce(p_values->>'occurred_at','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception 'Timestamp must include an offset' using errcode = '22023';
  end if;
  if p_kind = 'gi' then foreach key in array array['nausea','vomiting','constipation','diarrhea','reflux'] loop
    if coalesce(p_values->>key,'') !~ '^[0-3]$' then raise exception 'Invalid symptom intensity' using errcode = '22023'; end if;
  end loop; end if;
  return spec;
end $$;

create function endo_private.clinical_same_values(p_row jsonb,p_values jsonb,p_keys jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$ declare key text;
begin
  for key in select jsonb_array_elements_text(p_keys) loop
    if key = 'occurred_at' then
      if (p_row->>key)::timestamptz is distinct from (p_values->>key)::timestamptz then return false; end if;
    elsif (p_row->key) is distinct from (p_values->key) and not (p_row->key = 'null'::jsonb and not p_values ? key) then
      return false;
    end if;
  end loop;
  return true;
end $$;

-- Same validation and typed constraints serve both new entries and corrections.
create or replace function endo_private.clinical_save(p_kind text,p_version uuid,p_request uuid,p_values jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare spec jsonb; t text; s public.clinical_module_settings; v public.clinical_module_versions; previous jsonb; result jsonb;
begin
  if auth.uid() is null or p_request is null then raise insufficient_privilege; end if;
  spec := endo_private.clinical_record_input(p_kind,p_values); t := spec->>'table_name';
  s := endo_private.clinical_lock_module(spec->>'module_key');
  if s.current_version_id is distinct from p_version then raise exception 'Clinical plan changed; reload first' using errcode = 'PT409'; end if;
  select * into v from public.clinical_module_versions where id = p_version;
  if p_kind = 'injection' and ((p_values->>'occurred_at')::timestamptz at time zone (p_values->>'time_zone'))::date < v.anchor_date then
    raise exception 'Application predates this plan' using errcode = '22023';
  end if;
  execute format('select to_jsonb(r) from public.%I r where patient_id=$1 and request_id=$2',t) into previous using auth.uid(),p_request;
  if previous is not null then
    if (previous->>'module_version_id')::uuid is distinct from p_version or not endo_private.clinical_same_values(previous,p_values,spec->'keys') then
      raise exception 'Reused request identity' using errcode = 'PT409';
    end if;
    return previous;
  end if;
  execute format('insert into public.%I select (jsonb_populate_record(null::public.%I,$1)).* on conflict (patient_id,request_id) do nothing returning to_jsonb(%I.*)',t,t,t)
    into result using p_values || jsonb_build_object('id',gen_random_uuid(),'patient_id',auth.uid(),'module_key',spec->>'module_key','module_version_id',p_version,'request_id',p_request,'created_at',now());
  if result is null then return endo_private.clinical_save(p_kind,p_version,p_request,p_values); end if;
  return result;
end $$;

create function endo_private.clinical_correct(p_kind text,p_record uuid,p_request uuid,p_reason text,p_values jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare spec jsonb; t text; previous jsonb; replacement jsonb; retry public.clinical_record_corrections; audit public.clinical_record_corrections; v public.clinical_module_versions;
begin
  if auth.uid() is null or p_record is null or p_request is null then raise insufficient_privilege; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then raise exception 'Correction reason required (3 to 500 characters)' using errcode = '22023'; end if;
  spec := endo_private.clinical_record_spec(p_kind); t := spec->>'table_name';
  -- Serialize patient corrections, without blocking unrelated patients or changing a plan.
  perform 1 from public.profiles where id=auth.uid() for no key update;
  if not found then raise insufficient_privilege; end if;
  execute format('select to_jsonb(r) from public.%I r where id=$1 and patient_id=$2 for update',t) into previous using p_record,auth.uid();
  if previous is null then raise insufficient_privilege using message='Own patient record required'; end if;
  if p_values is not null then spec := endo_private.clinical_record_input(p_kind,p_values); end if;
  select * into retry from public.clinical_record_corrections where patient_id=auth.uid() and request_id=p_request;
  if found then
    if retry.kind is distinct from p_kind or retry.previous_record_id is distinct from p_record or retry.reason is distinct from btrim(p_reason)
      or (retry.replacement_record_id is null) is distinct from (p_values is null) then raise exception 'Reused correction request' using errcode = 'PT409'; end if;
    if p_values is not null then
      execute format('select to_jsonb(r) from public.%I r where id=$1 and patient_id=$2',t) into replacement using retry.replacement_record_id,auth.uid();
      if not endo_private.clinical_same_values(replacement,p_values,spec->'keys') then raise exception 'Reused correction request' using errcode = 'PT409'; end if;
    end if;
    return to_jsonb(retry);
  end if;
  if exists(select 1 from public.clinical_record_corrections where kind=p_kind and previous_record_id=p_record) then
    raise exception 'Record already corrected; reload first' using errcode = 'PT409';
  end if;
  if p_values is not null then
    if endo_private.clinical_same_values(previous,p_values,spec->'keys') then raise exception 'No clinical value changed' using errcode = '22023'; end if;
    select * into v from public.clinical_module_versions where id=(previous->>'module_version_id')::uuid;
    if p_kind='injection' and ((p_values->>'occurred_at')::timestamptz at time zone (p_values->>'time_zone'))::date < v.anchor_date then
      raise exception 'Application predates the original plan' using errcode='22023';
    end if;
    execute format('insert into public.%I select (jsonb_populate_record(null::public.%I,$1)).* on conflict (patient_id,request_id) do nothing returning to_jsonb(%I.*)',t,t,t)
      into replacement using p_values || jsonb_build_object('id',gen_random_uuid(),'patient_id',auth.uid(),'module_key',spec->>'module_key','module_version_id',previous->>'module_version_id','request_id',p_request,'created_at',now());
    if replacement is null then raise exception 'Request already used by another record' using errcode='PT409'; end if;
  end if;
  insert into public.clinical_record_corrections(patient_id,actor_id,kind,previous_record_id,replacement_record_id,reason,request_id)
    values(auth.uid(),auth.uid(),p_kind,p_record,(replacement->>'id')::uuid,btrim(p_reason),p_request) returning * into audit;
  return to_jsonb(audit);
end $$;

create function public.endo_correct_clinical_record(p_actor_id uuid,p_kind text,p_record_id uuid,p_request_id uuid,p_reason text,p_values jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$ begin
  perform endo_private.clinical_actor(p_actor_id);
  return endo_private.clinical_correct(p_kind,p_record_id,p_request_id,p_reason,p_values);
end $$;
revoke all on function endo_private.clinical_record_spec(text) from public,anon,authenticated;
revoke all on function endo_private.clinical_record_input(text,jsonb) from public,anon,authenticated;
revoke all on function endo_private.clinical_same_values(jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function endo_private.clinical_correct(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.endo_correct_clinical_record(uuid,text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function endo_private.clinical_correct(text,uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.endo_correct_clinical_record(uuid,text,uuid,uuid,text,jsonb) to authenticated;
