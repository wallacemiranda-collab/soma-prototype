-- CGM pilot backend. Apply only to an isolated homologation project after local tests.
-- Raw CSV files are not stored; only validated, normalized readings are persisted.

create schema if not exists endo_private;
revoke all on schema endo_private from public, anon;
grant usage on schema endo_private to authenticated;

create table public.patient_cgm_consents (
  patient_id uuid not null references public.profiles(id) on delete cascade,
  source_key text not null check (source_key = 'libreview_csv'),
  consent_version text not null check (consent_version = 'endo-cgm-import-v1'),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  grant_request_id uuid not null,
  primary key (patient_id, source_key),
  check (revoked_at is null or revoked_at >= granted_at)
);

create table public.patient_cgm_consent_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  source_key text not null check (source_key = 'libreview_csv'),
  consent_version text not null check (consent_version = 'endo-cgm-import-v1'),
  action text not null check (action in ('granted', 'revoked', 'data_deleted')),
  request_id uuid not null,
  rows_affected integer not null default 0 check (rows_affected >= 0),
  occurred_at timestamptz not null default now(),
  unique (patient_id, request_id)
);
create index patient_cgm_consent_events_patient_time_idx
  on public.patient_cgm_consent_events (patient_id, occurred_at desc, id desc);

create table public.patient_cgm_imports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  source_key text not null check (source_key = 'libreview_csv'),
  consent_version text not null check (consent_version = 'endo-cgm-import-v1'),
  consent_request_id uuid not null,
  parser_version text not null check (parser_version = 'libreview-glucose-v1'),
  time_zone text not null check (char_length(time_zone) between 1 and 80),
  request_id uuid not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  submitted_rows integer not null check (submitted_rows between 1 and 25000),
  inserted_rows integer not null default 0 check (inserted_rows between 0 and submitted_rows),
  duplicate_rows integer not null default 0 check (duplicate_rows between 0 and submitted_rows),
  first_reading_at timestamptz not null,
  last_reading_at timestamptz not null,
  imported_at timestamptz not null default now(),
  unique (patient_id, request_id),
  unique (id, patient_id, consent_request_id),
  foreign key (patient_id, source_key)
    references public.patient_cgm_consents(patient_id, source_key),
  check (first_reading_at <= last_reading_at)
);
create index patient_cgm_imports_patient_time_idx
  on public.patient_cgm_imports (patient_id, imported_at desc, id desc);

create table public.patient_cgm_readings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  import_id uuid not null,
  consent_request_id uuid not null,
  source_key text not null check (source_key = 'libreview_csv'),
  occurred_at timestamptz not null check (occurred_at <= now()),
  time_zone text not null check (char_length(time_zone) between 1 and 80),
  glucose_mg_dl numeric not null check (glucose_mg_dl between 20 and 1000),
  reading_type text not null check (reading_type in ('automatic', 'scanned', 'unknown')),
  created_at timestamptz not null default now(),
  foreign key (import_id, patient_id, consent_request_id)
    references public.patient_cgm_imports(id, patient_id, consent_request_id) on delete cascade
);
create unique index patient_cgm_readings_dedupe_idx
  on public.patient_cgm_readings
    (patient_id, source_key, consent_request_id, occurred_at, glucose_mg_dl, reading_type);
create index patient_cgm_readings_patient_time_idx
  on public.patient_cgm_readings (patient_id, occurred_at, id);
create index patient_cgm_readings_import_idx
  on public.patient_cgm_readings (import_id);

create table public.patient_cgm_access_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  doctor_id uuid not null references public.doctor_profiles(user_id) on delete cascade,
  request_id uuid not null,
  cursor_occurred_at timestamptz,
  cursor_id uuid,
  page_limit integer not null check (page_limit between 1 and 500),
  rows_returned integer not null check (rows_returned between 0 and 500),
  accessed_at timestamptz not null default now(),
  unique (patient_id, doctor_id, request_id),
  check ((cursor_occurred_at is null) = (cursor_id is null))
);
create index patient_cgm_access_logs_patient_time_idx
  on public.patient_cgm_access_logs (patient_id, accessed_at desc, id desc);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'patient_cgm_consents', 'patient_cgm_consent_events',
    'patient_cgm_imports', 'patient_cgm_readings', 'patient_cgm_access_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (patient_id = (select auth.uid()))',
      table_name || '_patient_read_own', table_name
    );
  end loop;
end;
$$;

create function endo_private.cgm_grant_consent(
  p_source_key text, p_request_id uuid, p_consent_version text, p_confirmed boolean
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_consent public.patient_cgm_consents; previous_event public.patient_cgm_consent_events;
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  if p_source_key <> 'libreview_csv' or p_consent_version <> 'endo-cgm-import-v1'
    or p_request_id is null or p_confirmed is distinct from true then
    raise exception 'Explicit consent is required' using errcode = '22023';
  end if;
  select * into previous_event from public.patient_cgm_consent_events
    where patient_id = auth.uid() and request_id = p_request_id;
  if found then
    if previous_event.action <> 'granted' or previous_event.source_key <> p_source_key
      or previous_event.consent_version <> p_consent_version then
      raise exception 'Consent request identity was reused' using errcode = 'PT409';
    end if;
    select * into current_consent from public.patient_cgm_consents
      where patient_id = auth.uid() and source_key = p_source_key;
    return to_jsonb(current_consent);
  end if;
  insert into public.patient_cgm_consents
    (patient_id, source_key, consent_version, granted_at, revoked_at, grant_request_id)
    values (auth.uid(), p_source_key, p_consent_version, now(), null, p_request_id)
    on conflict (patient_id, source_key) do update
      set consent_version = excluded.consent_version,
          granted_at = excluded.granted_at,
          revoked_at = null,
          grant_request_id = excluded.grant_request_id
    returning * into current_consent;
  insert into public.patient_cgm_consent_events
    (patient_id, source_key, consent_version, action, request_id)
    values (auth.uid(), p_source_key, p_consent_version, 'granted', p_request_id);
  return to_jsonb(current_consent);
end;
$$;

create function endo_private.cgm_revoke_consent(p_source_key text, p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_consent public.patient_cgm_consents; previous_event public.patient_cgm_consent_events;
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  if p_source_key <> 'libreview_csv' or p_request_id is null then
    raise exception 'Invalid consent request' using errcode = '22023';
  end if;
  select * into previous_event from public.patient_cgm_consent_events
    where patient_id = auth.uid() and request_id = p_request_id;
  if found then
    if previous_event.action <> 'revoked' or previous_event.source_key <> p_source_key then
      raise exception 'Consent request identity was reused' using errcode = 'PT409';
    end if;
    return jsonb_build_object('revoked', true);
  end if;
  select * into current_consent from public.patient_cgm_consents
    where patient_id = auth.uid() and source_key = p_source_key for update;
  if not found then return jsonb_build_object('revoked', false); end if;
  update public.patient_cgm_consents set revoked_at = coalesce(revoked_at, now())
    where patient_id = auth.uid() and source_key = p_source_key
    returning * into current_consent;
  insert into public.patient_cgm_consent_events
    (patient_id, source_key, consent_version, action, request_id)
    values (auth.uid(), p_source_key, current_consent.consent_version, 'revoked', p_request_id);
  return jsonb_build_object('revoked', true, 'consent', to_jsonb(current_consent));
end;
$$;

create function endo_private.cgm_delete_imports(
  p_source_key text, p_request_id uuid, p_confirmed boolean
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_consent public.patient_cgm_consents; previous_event public.patient_cgm_consent_events; deleted_count integer;
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  if p_source_key <> 'libreview_csv' or p_request_id is null or p_confirmed is distinct from true then
    raise exception 'Explicit deletion confirmation is required' using errcode = '22023';
  end if;
  select * into previous_event from public.patient_cgm_consent_events
    where patient_id = auth.uid() and request_id = p_request_id;
  if found then
    if previous_event.action <> 'data_deleted' or previous_event.source_key <> p_source_key then
      raise exception 'Deletion request identity was reused' using errcode = 'PT409';
    end if;
    return jsonb_build_object('deleted', previous_event.rows_affected);
  end if;
  select * into current_consent from public.patient_cgm_consents
    where patient_id = auth.uid() and source_key = p_source_key for update;
  if not found then raise insufficient_privilege using message = 'No patient consent record'; end if;
  select count(*) into deleted_count from public.patient_cgm_readings
    where patient_id = auth.uid() and source_key = p_source_key;
  delete from public.patient_cgm_imports
    where patient_id = auth.uid() and source_key = p_source_key;
  insert into public.patient_cgm_consent_events
    (patient_id, source_key, consent_version, action, request_id, rows_affected)
    values (auth.uid(), p_source_key, current_consent.consent_version, 'data_deleted', p_request_id, deleted_count);
  return jsonb_build_object('deleted', deleted_count);
end;
$$;

create function endo_private.cgm_import_readings(
  p_source_key text, p_request_id uuid, p_time_zone text, p_parser_version text, p_readings jsonb
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_consent public.patient_cgm_consents; previous_import public.patient_cgm_imports;
  created_id uuid; payload_hash text; reading jsonb; reading_time timestamptz;
  reading_value numeric; reading_kind text; submitted integer; inserted integer;
  first_time timestamptz; last_time timestamptz; object_key_count integer; existing_count integer;
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  if p_source_key <> 'libreview_csv' or p_request_id is null
    or p_parser_version <> 'libreview-glucose-v1'
    or p_time_zone is null or char_length(p_time_zone) not between 1 and 80
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone)
    or p_readings is null or jsonb_typeof(p_readings) <> 'array' then
    raise exception 'Invalid CGM import request' using errcode = '22023';
  end if;
  submitted := jsonb_array_length(p_readings);
  if submitted < 1 or submitted > 25000 or pg_catalog.pg_column_size(p_readings) > 8000000 then
    raise exception 'CGM import size is outside the pilot limit' using errcode = '22023';
  end if;
  select * into current_consent from public.patient_cgm_consents
    where patient_id = auth.uid() and source_key = p_source_key and revoked_at is null
    for update;
  if not found then raise insufficient_privilege using message = 'Active patient consent required'; end if;
  payload_hash := pg_catalog.encode(extensions.digest(p_readings::text, 'sha256'), 'hex');
  select * into previous_import from public.patient_cgm_imports
    where patient_id = auth.uid() and request_id = p_request_id;
  if found then
    if previous_import.source_key <> p_source_key or previous_import.time_zone <> p_time_zone
      or previous_import.parser_version <> p_parser_version
      or previous_import.consent_request_id <> current_consent.grant_request_id
      or previous_import.submitted_rows <> submitted
      or previous_import.payload_sha256 <> payload_hash then
      raise exception 'Import request identity was reused' using errcode = 'PT409';
    end if;
    return to_jsonb(previous_import);
  end if;
  for reading in select value from jsonb_array_elements(p_readings) loop
    if jsonb_typeof(reading) <> 'object' then
      raise exception 'CGM import contains an invalid reading' using errcode = '22023';
    end if;
    select count(*) into object_key_count from pg_catalog.jsonb_object_keys(reading);
    if object_key_count <> 3
      or not (reading ?& array['occurred_at', 'value_mg_dl', 'kind'])
      or jsonb_typeof(reading->'occurred_at') <> 'string'
      or jsonb_typeof(reading->'value_mg_dl') <> 'number'
      or jsonb_typeof(reading->'kind') <> 'string'
      or coalesce(reading->>'occurred_at', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
      or reading->>'kind' not in ('automatic', 'scanned', 'unknown') then
      raise exception 'CGM import contains an invalid reading' using errcode = '22023';
    end if;
    reading_time := (reading->>'occurred_at')::timestamptz;
    reading_value := (reading->>'value_mg_dl')::numeric;
    reading_kind := reading->>'kind';
    if reading_time > now() or reading_value < 20 or reading_value > 1000 then
      raise exception 'CGM import contains an out-of-range reading' using errcode = '22023';
    end if;
    first_time := least(coalesce(first_time, reading_time), reading_time);
    last_time := greatest(coalesce(last_time, reading_time), reading_time);
  end loop;
  insert into public.patient_cgm_imports
    (patient_id, source_key, consent_version, consent_request_id, parser_version, time_zone,
      request_id, payload_sha256, submitted_rows, first_reading_at, last_reading_at)
    values (auth.uid(), p_source_key, current_consent.consent_version,
      current_consent.grant_request_id, p_parser_version,
      p_time_zone, p_request_id, payload_hash, submitted, first_time, last_time)
    returning id into created_id;
  with normalized as (
    select (item->>'occurred_at')::timestamptz as occurred_at,
      (item->>'value_mg_dl')::numeric as glucose_mg_dl,
      item->>'kind' as reading_type
    from jsonb_array_elements(p_readings) as input(item)
  ), inserted_rows as (
    insert into public.patient_cgm_readings
      (patient_id, import_id, consent_request_id, source_key, occurred_at, time_zone, glucose_mg_dl, reading_type)
    select auth.uid(), created_id, current_consent.grant_request_id, p_source_key,
      n.occurred_at, p_time_zone, n.glucose_mg_dl, n.reading_type
    from normalized n
    on conflict (patient_id, source_key, consent_request_id, occurred_at, glucose_mg_dl, reading_type) do nothing
    returning 1
  ) select count(*) into inserted from inserted_rows;
  update public.patient_cgm_imports set inserted_rows = inserted, duplicate_rows = submitted - inserted
    where id = created_id returning * into previous_import;
  select count(*) into existing_count from public.patient_cgm_readings
    where patient_id = auth.uid() and source_key = p_source_key;
  if existing_count > 25000 then
    raise exception 'CGM patient history limit exceeded' using errcode = '22023';
  end if;
  return to_jsonb(previous_import);
end;
$$;

create function endo_private.doctor_cgm_page(
  p_patient_id uuid, p_request_id uuid, p_after_occurred_at timestamptz,
  p_after_id uuid, p_limit integer
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); share_row public.patient_shares; setting public.clinical_module_settings;
  consent public.patient_cgm_consents; result jsonb; row_count integer; audit_inserted integer;
  prior_log public.patient_cgm_access_logs;
begin
  if actor is null or p_patient_id is null or actor = p_patient_id or p_request_id is null
    or p_limit is null or p_limit < 1 or p_limit > 500
    or ((p_after_occurred_at is null) <> (p_after_id is null)) then
    raise exception 'Invalid CGM page request' using errcode = '22023';
  end if;
  select * into share_row from public.patient_shares
    where patient_id = p_patient_id and doctor_id = actor and revoked_at is null
      and (expires_at is null or expires_at > now()) for share;
  if not found then raise insufficient_privilege using message = 'Active patient sharing required'; end if;
  select * into setting from public.clinical_module_settings
    where patient_id = p_patient_id and module_key = 'diabetes' and doctor_id = actor
    for share;
  if not found or not endo_private.clinical_active(setting.id) then
    raise insufficient_privilege using message = 'Active diabetes module required';
  end if;
  perform 1 from public.patient_module_permissions permission
    where permission.id = setting.permission_id and permission.patient_id = p_patient_id
      and permission.doctor_id = actor and permission.revoked_at is null
      and permission.share_granted_at = share_row.granted_at for share;
  if not found then raise insufficient_privilege using message = 'Current clinical consent required'; end if;
  select * into consent from public.patient_cgm_consents
    where patient_id = p_patient_id and source_key = 'libreview_csv' and revoked_at is null
    for share;
  if not found then raise insufficient_privilege using message = 'Active CGM source consent required'; end if;
  select * into prior_log from public.patient_cgm_access_logs
    where patient_id = p_patient_id and doctor_id = actor and request_id = p_request_id;
  if found then
    if prior_log.cursor_occurred_at is distinct from p_after_occurred_at
      or prior_log.cursor_id is distinct from p_after_id or prior_log.page_limit <> p_limit then
      raise exception 'CGM access request identity was reused' using errcode = 'PT409';
    end if;
    raise exception 'CGM access request identity was already used' using errcode = 'PT409';
  end if;
  select coalesce(jsonb_agg(to_jsonb(page_row) order by page_row.occurred_at, page_row.id), '[]'::jsonb)
    into result
    from (
      select r.id, r.occurred_at, r.time_zone, r.glucose_mg_dl, r.reading_type,
        r.source_key, r.import_id
      from public.patient_cgm_readings r
      where r.patient_id = p_patient_id and r.source_key = 'libreview_csv'
        and r.consent_request_id = consent.grant_request_id
        and (p_after_occurred_at is null or (r.occurred_at, r.id) > (p_after_occurred_at, p_after_id))
      order by r.occurred_at, r.id limit p_limit
    ) page_row;
  row_count := jsonb_array_length(result);
  insert into public.patient_cgm_access_logs
    (patient_id, doctor_id, request_id, cursor_occurred_at, cursor_id, page_limit, rows_returned)
    values (p_patient_id, actor, p_request_id, p_after_occurred_at, p_after_id, p_limit, row_count)
    on conflict (patient_id, doctor_id, request_id) do nothing;
  get diagnostics audit_inserted = row_count;
  if audit_inserted = 0 then
    raise exception 'CGM access request identity was already used' using errcode = 'PT409';
  end if;
  return result;
end;
$$;

create function public.endo_grant_cgm_consent(
  p_actor_id uuid, p_source_key text, p_request_id uuid, p_consent_version text, p_confirmed boolean
)
returns jsonb language plpgsql security invoker set search_path = '' as $$ begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise insufficient_privilege using message = 'Authenticated account changed';
  end if;
  return endo_private.cgm_grant_consent(p_source_key, p_request_id, p_consent_version, p_confirmed);
end; $$;
create function public.endo_revoke_cgm_consent(p_actor_id uuid, p_source_key text, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$ begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise insufficient_privilege using message = 'Authenticated account changed';
  end if;
  return endo_private.cgm_revoke_consent(p_source_key, p_request_id);
end; $$;
create function public.endo_delete_cgm_imports(p_actor_id uuid, p_source_key text, p_request_id uuid, p_confirmed boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$ begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise insufficient_privilege using message = 'Authenticated account changed';
  end if;
  return endo_private.cgm_delete_imports(p_source_key, p_request_id, p_confirmed);
end; $$;
create function public.endo_import_cgm_readings(
  p_actor_id uuid, p_source_key text, p_request_id uuid, p_time_zone text,
  p_parser_version text, p_readings jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$ begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise insufficient_privilege using message = 'Authenticated account changed';
  end if;
  return endo_private.cgm_import_readings(p_source_key, p_request_id, p_time_zone, p_parser_version, p_readings);
end; $$;
create function public.endo_doctor_cgm_page(
  p_actor_id uuid, p_patient_id uuid, p_request_id uuid, p_after_occurred_at timestamptz,
  p_after_id uuid, p_limit integer
)
returns jsonb language plpgsql security invoker set search_path = '' as $$ begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise insufficient_privilege using message = 'Authenticated account changed';
  end if;
  return endo_private.doctor_cgm_page(p_patient_id, p_request_id, p_after_occurred_at, p_after_id, p_limit);
end; $$;

do $$
declare signature text;
begin
  foreach signature in array array[
    'endo_private.cgm_grant_consent(text,uuid,text,boolean)',
    'endo_private.cgm_revoke_consent(text,uuid)',
    'endo_private.cgm_delete_imports(text,uuid,boolean)',
    'endo_private.cgm_import_readings(text,uuid,text,text,jsonb)',
    'endo_private.doctor_cgm_page(uuid,uuid,timestamptz,uuid,integer)',
    'public.endo_grant_cgm_consent(uuid,text,uuid,text,boolean)',
    'public.endo_revoke_cgm_consent(uuid,text,uuid)',
    'public.endo_delete_cgm_imports(uuid,text,uuid,boolean)',
    'public.endo_import_cgm_readings(uuid,text,uuid,text,text,jsonb)',
    'public.endo_doctor_cgm_page(uuid,uuid,uuid,timestamptz,uuid,integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to authenticated', signature);
  end loop;
end;
$$;
