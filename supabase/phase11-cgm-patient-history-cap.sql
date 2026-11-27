create or replace function endo_private.cgm_import_readings(
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
