-- LibreView PDF reports for isolated homologation only.
-- Raw PDFs stay in a private Storage bucket. Only approved AGP summary fields
-- are copied to the report row; name, birth date, clinic and phone are omitted.

alter table public.patient_cgm_consents
  drop constraint if exists patient_cgm_consents_source_key_check,
  drop constraint if exists patient_cgm_consents_consent_version_check;
alter table public.patient_cgm_consents
  add constraint patient_cgm_consents_source_key_check
    check (source_key in ('libreview_csv', 'libreview_pdf')),
  add constraint patient_cgm_consents_consent_version_check
    check (
      (source_key = 'libreview_csv' and consent_version = 'endo-cgm-import-v1')
      or (source_key = 'libreview_pdf' and consent_version = 'endo-cgm-pdf-v1')
    );

alter table public.patient_cgm_consent_events
  drop constraint if exists patient_cgm_consent_events_source_key_check,
  drop constraint if exists patient_cgm_consent_events_consent_version_check;
alter table public.patient_cgm_consent_events
  add constraint patient_cgm_consent_events_source_key_check
    check (source_key in ('libreview_csv', 'libreview_pdf')),
  add constraint patient_cgm_consent_events_consent_version_check
    check (
      (source_key = 'libreview_csv' and consent_version = 'endo-cgm-import-v1')
      or (source_key = 'libreview_pdf' and consent_version = 'endo-cgm-pdf-v1')
    );

create or replace function endo_private.cgm_grant_consent(
  p_source_key text, p_request_id uuid, p_consent_version text, p_confirmed boolean
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_consent public.patient_cgm_consents; previous_event public.patient_cgm_consent_events;
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  if p_source_key not in ('libreview_csv', 'libreview_pdf')
    or p_consent_version is distinct from (case p_source_key
      when 'libreview_csv' then 'endo-cgm-import-v1'
      when 'libreview_pdf' then 'endo-cgm-pdf-v1'
    end)
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

create or replace function endo_private.cgm_revoke_consent(p_source_key text, p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_consent public.patient_cgm_consents; previous_event public.patient_cgm_consent_events;
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  if p_source_key not in ('libreview_csv', 'libreview_pdf') or p_request_id is null then
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('endo-cgm-libre-pdf', 'endo-cgm-libre-pdf', false, 10000000, array['application/pdf']);

create table public.patient_cgm_pdf_reports (
  id uuid primary key,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  consent_request_id uuid not null,
  request_id uuid not null,
  storage_path text not null unique,
  parse_status text not null check (parse_status in ('recognized', 'unrecognized')),
  parser_version text not null check (parser_version = 'libreview-agp-text-v1'),
  language text check (language in ('pt', 'en')),
  period_start date,
  period_end date,
  sensor_active_percent numeric(5,2),
  time_very_high_percent numeric(5,2),
  time_high_percent numeric(5,2),
  time_in_range_percent numeric(5,2),
  time_low_percent numeric(5,2),
  time_very_low_percent numeric(5,2),
  mean_glucose_mg_dl numeric(7,2),
  gmi_percent numeric(5,2),
  gmi_mmol_mol numeric(6,2),
  coefficient_variation_percent numeric(5,2),
  device text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  delete_request_id uuid,
  unique (patient_id, request_id),
  check (storage_path = patient_id::text || '/' || id::text || '.pdf'),
  check (period_end is null or period_start is null or period_end >= period_start),
  check (period_end is null or period_end <= current_date),
  check ((deleted_at is null) = (delete_request_id is null)),
  check (
    (parse_status = 'unrecognized'
      and language is null and period_start is null and period_end is null
      and sensor_active_percent is null and time_very_high_percent is null
      and time_high_percent is null and time_in_range_percent is null
      and time_low_percent is null and time_very_low_percent is null
      and mean_glucose_mg_dl is null and gmi_percent is null
      and gmi_mmol_mol is null and coefficient_variation_percent is null and device is null)
    or
    (parse_status = 'recognized'
      and language is not null and period_start is not null and period_end is not null
      and sensor_active_percent between 0 and 100
      and time_very_high_percent between 0 and 100
      and time_high_percent between 0 and 100
      and time_in_range_percent between 0 and 100
      and time_low_percent between 0 and 100
      and time_very_low_percent between 0 and 100
      and time_very_high_percent + time_high_percent + time_in_range_percent
        + time_low_percent + time_very_low_percent between 97 and 103
      and mean_glucose_mg_dl between 20 and 1000
      and gmi_percent > 0 and gmi_percent <= 20
      and gmi_mmol_mol between 0 and 300
      and coefficient_variation_percent between 0 and 200
      and device in ('FreeStyle LibreLink', 'FreeStyle Libre', 'FreeStyle Libre 2', 'FreeStyle Libre 3', 'FreeStyle Libre 3 Plus'))
  )
);
create index patient_cgm_pdf_reports_patient_period_idx
  on public.patient_cgm_pdf_reports (patient_id, period_end desc, created_at desc)
  where deleted_at is null;

create table public.patient_cgm_pdf_access_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid references public.patient_cgm_pdf_reports(id) on delete set null,
  action text not null check (action in ('metadata', 'file', 'delete')),
  request_id uuid not null,
  accessed_at timestamptz not null default now(),
  unique (patient_id, actor_id, request_id, action)
);
create index patient_cgm_pdf_access_logs_patient_time_idx
  on public.patient_cgm_pdf_access_logs (patient_id, accessed_at desc, id desc);
create index patient_cgm_pdf_access_logs_actor_time_idx
  on public.patient_cgm_pdf_access_logs (actor_id, accessed_at desc, id desc);
create index patient_cgm_pdf_access_logs_report_idx
  on public.patient_cgm_pdf_access_logs (report_id) where report_id is not null;

alter table public.patient_cgm_pdf_reports enable row level security;
revoke all on public.patient_cgm_pdf_reports from public, anon, authenticated;
grant select on public.patient_cgm_pdf_reports to authenticated;
create policy patient_cgm_pdf_reports_read_self on public.patient_cgm_pdf_reports
  for select to authenticated using (patient_id = (select auth.uid()) and deleted_at is null);

alter table public.patient_cgm_pdf_access_logs enable row level security;
revoke all on public.patient_cgm_pdf_access_logs from public, anon, authenticated;
grant select on public.patient_cgm_pdf_access_logs to authenticated;
create policy patient_cgm_pdf_access_logs_read_self on public.patient_cgm_pdf_access_logs
  for select to authenticated using (patient_id = (select auth.uid()));

create policy endo_cgm_pdf_patient_upload on storage.objects
  for insert to authenticated with check (
    bucket_id = 'endo-cgm-libre-pdf'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and split_part(name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
    and split_part(name, '/', 3) = ''
  );
create policy endo_cgm_pdf_patient_orphan_cleanup on storage.objects
  for delete to authenticated using (
    bucket_id = 'endo-cgm-libre-pdf'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );
-- Deliberately no client SELECT policy: reads go through an authenticated,
-- audited Edge Function, then Storage is accessed with its server secret.

create function endo_private.require_cgm_pdf_doctor_access(p_patient_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); share_row public.patient_shares;
  setting public.clinical_module_settings; current_consent public.patient_cgm_consents;
begin
  if actor is null or p_patient_id is null or actor = p_patient_id then
    raise insufficient_privilege using message = 'Invalid CGM report access';
  end if;
  if not exists (select 1 from public.doctor_profiles where user_id = actor) then
    raise insufficient_privilege using message = 'Doctor account required';
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
  select * into current_consent from public.patient_cgm_consents
    where patient_id = p_patient_id and source_key = 'libreview_pdf' and revoked_at is null
    for share;
  if not found then raise insufficient_privilege using message = 'Active PDF consent required'; end if;
  return current_consent.grant_request_id;
end;
$$;

create function endo_private.cgm_register_pdf_report(
  p_report_id uuid, p_request_id uuid, p_storage_path text, p_parser_version text,
  p_parse_status text, p_metrics jsonb
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_consent public.patient_cgm_consents; existing_report public.patient_cgm_pdf_reports;
  metric_count integer; language_value text; start_value date; end_value date;
  sensor_value numeric; very_high_value numeric; high_value numeric; target_value numeric;
  low_value numeric; very_low_value numeric; mean_value numeric; gmi_value numeric;
  gmi_mmol_value numeric; cv_value numeric; device_value text; report_count integer;
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  if p_report_id is null or p_request_id is null or p_parser_version <> 'libreview-agp-text-v1'
    or p_parse_status not in ('recognized', 'unrecognized')
    or p_storage_path is distinct from auth.uid()::text || '/' || p_report_id::text || '.pdf'
    or p_metrics is null or jsonb_typeof(p_metrics) <> 'object' then
    raise exception 'Invalid LibreView PDF report' using errcode = '22023';
  end if;
  select * into current_consent from public.patient_cgm_consents
    where patient_id = auth.uid() and source_key = 'libreview_pdf' and revoked_at is null
    for update;
  if not found then raise insufficient_privilege using message = 'Active PDF consent required'; end if;
  if not exists (
    select 1 from storage.objects object
    where object.bucket_id = 'endo-cgm-libre-pdf' and object.name = p_storage_path
      and object.owner_id = auth.uid()::text
  ) then raise insufficient_privilege using message = 'Private PDF upload required'; end if;
  select * into existing_report from public.patient_cgm_pdf_reports
    where patient_id = auth.uid() and request_id = p_request_id for update;
  if found then
    if existing_report.id <> p_report_id or existing_report.storage_path <> p_storage_path
      or existing_report.parse_status <> p_parse_status or existing_report.parser_version <> p_parser_version
      or existing_report.consent_request_id <> current_consent.grant_request_id then
      raise exception 'PDF report request identity was reused' using errcode = 'PT409';
    end if;
    return to_jsonb(existing_report);
  end if;
  select count(*) into report_count from public.patient_cgm_pdf_reports
    where patient_id = auth.uid() and deleted_at is null;
  if report_count >= 100 then raise exception 'CGM PDF report history limit exceeded' using errcode = '22023'; end if;

  if p_parse_status = 'unrecognized' then
    if p_metrics <> '{}'::jsonb then raise exception 'Unrecognized report cannot include extracted values' using errcode = '22023'; end if;
    insert into public.patient_cgm_pdf_reports
      (id, patient_id, consent_request_id, request_id, storage_path, parse_status, parser_version)
      values (p_report_id, auth.uid(), current_consent.grant_request_id, p_request_id,
        p_storage_path, p_parse_status, p_parser_version)
      returning * into existing_report;
    return to_jsonb(existing_report);
  end if;

  select count(*) into metric_count from pg_catalog.jsonb_object_keys(p_metrics);
  if metric_count <> 14 or not (p_metrics ?& array[
    'language', 'periodStart', 'periodEnd', 'sensorActivePercent',
    'timeVeryHighPercent', 'timeHighPercent', 'timeInRangePercent', 'timeLowPercent',
    'timeVeryLowPercent', 'meanGlucoseMgDl', 'gmiPercent', 'gmiMmolMol',
    'coefficientVariationPercent', 'device'
  ]) then raise exception 'Incomplete or unexpected LibreView metrics' using errcode = '22023'; end if;
  language_value := p_metrics->>'language';
  start_value := (p_metrics->>'periodStart')::date;
  end_value := (p_metrics->>'periodEnd')::date;
  sensor_value := (p_metrics->>'sensorActivePercent')::numeric;
  very_high_value := (p_metrics->>'timeVeryHighPercent')::numeric;
  high_value := (p_metrics->>'timeHighPercent')::numeric;
  target_value := (p_metrics->>'timeInRangePercent')::numeric;
  low_value := (p_metrics->>'timeLowPercent')::numeric;
  very_low_value := (p_metrics->>'timeVeryLowPercent')::numeric;
  mean_value := (p_metrics->>'meanGlucoseMgDl')::numeric;
  gmi_value := (p_metrics->>'gmiPercent')::numeric;
  gmi_mmol_value := (p_metrics->>'gmiMmolMol')::numeric;
  cv_value := (p_metrics->>'coefficientVariationPercent')::numeric;
  device_value := p_metrics->>'device';
  if language_value not in ('pt', 'en') or start_value is null or end_value is null
    or start_value > end_value or end_value > current_date
    or sensor_value not between 0 and 100
    or very_high_value not between 0 and 100 or high_value not between 0 and 100
    or target_value not between 0 and 100 or low_value not between 0 and 100
    or very_low_value not between 0 and 100
    or very_high_value + high_value + target_value + low_value + very_low_value not between 97 and 103
    or mean_value not between 20 and 1000 or gmi_value <= 0 or gmi_value > 20
    or gmi_mmol_value not between 0 and 300 or cv_value not between 0 and 200
    or device_value not in ('FreeStyle LibreLink', 'FreeStyle Libre', 'FreeStyle Libre 2', 'FreeStyle Libre 3', 'FreeStyle Libre 3 Plus') then
    raise exception 'LibreView metrics outside allowed ranges' using errcode = '22023';
  end if;
  insert into public.patient_cgm_pdf_reports (
    id, patient_id, consent_request_id, request_id, storage_path, parse_status, parser_version,
    language, period_start, period_end, sensor_active_percent, time_very_high_percent,
    time_high_percent, time_in_range_percent, time_low_percent, time_very_low_percent,
    mean_glucose_mg_dl, gmi_percent, gmi_mmol_mol, coefficient_variation_percent, device
  ) values (
    p_report_id, auth.uid(), current_consent.grant_request_id, p_request_id, p_storage_path,
    p_parse_status, p_parser_version, language_value, start_value, end_value, sensor_value,
    very_high_value, high_value, target_value, low_value, very_low_value, mean_value,
    gmi_value, gmi_mmol_value, cv_value, device_value
  ) returning * into existing_report;
  return to_jsonb(existing_report);
end;
$$;

create function endo_private.doctor_cgm_pdf_page(p_patient_id uuid, p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); current_grant uuid; result jsonb; prior_log public.patient_cgm_pdf_access_logs;
begin
  if actor is null or p_request_id is null then raise exception 'Invalid CGM PDF request' using errcode = '22023'; end if;
  current_grant := endo_private.require_cgm_pdf_doctor_access(p_patient_id);
  select * into prior_log from public.patient_cgm_pdf_access_logs
    where patient_id = p_patient_id and actor_id = actor and request_id = p_request_id and action = 'metadata';
  if found then raise exception 'CGM PDF metadata request identity was already used' using errcode = 'PT409'; end if;
  select coalesce(jsonb_agg(to_jsonb(page_row) order by page_row.period_end desc nulls last, page_row.created_at desc), '[]'::jsonb)
    into result
    from (
      select id, patient_id, parse_status, parser_version, language, period_start, period_end,
        sensor_active_percent, time_very_high_percent, time_high_percent, time_in_range_percent,
        time_low_percent, time_very_low_percent, mean_glucose_mg_dl, gmi_percent, gmi_mmol_mol,
        coefficient_variation_percent, device, created_at
      from public.patient_cgm_pdf_reports
      where patient_id = p_patient_id and consent_request_id = current_grant and deleted_at is null
      order by period_end desc nulls last, created_at desc limit 101
    ) page_row;
  if jsonb_array_length(result) > 100 then raise exception 'CGM PDF report history limit exceeded' using errcode = '22023'; end if;
  insert into public.patient_cgm_pdf_access_logs (patient_id, actor_id, action, request_id)
    values (p_patient_id, actor, 'metadata', p_request_id);
  return result;
end;
$$;

create function endo_private.authorize_cgm_pdf_file(
  p_report_id uuid, p_request_id uuid, p_action text
)
returns text
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); report public.patient_cgm_pdf_reports;
  existing_log public.patient_cgm_pdf_access_logs; current_grant uuid; log_action text;
begin
  if actor is null or p_report_id is null or p_request_id is null
    or p_action not in ('read', 'delete') then
    raise exception 'Invalid CGM PDF file request' using errcode = '22023';
  end if;
  select * into report from public.patient_cgm_pdf_reports
    where id = p_report_id and deleted_at is null for share;
  if not found then raise insufficient_privilege using message = 'Active CGM PDF report required'; end if;
  if actor = report.patient_id then
    if p_action = 'read' then log_action := 'file'; else log_action := 'delete'; end if;
  else
    if p_action = 'delete' then raise insufficient_privilege using message = 'Patient account required'; end if;
    current_grant := endo_private.require_cgm_pdf_doctor_access(report.patient_id);
    if report.consent_request_id <> current_grant then
      raise insufficient_privilege using message = 'Current PDF consent required';
    end if;
    log_action := 'file';
  end if;
  select * into existing_log from public.patient_cgm_pdf_access_logs
    where patient_id = report.patient_id and actor_id = actor
      and request_id = p_request_id and action = log_action;
  if found then raise exception 'CGM PDF file request identity was already used' using errcode = 'PT409'; end if;
  insert into public.patient_cgm_pdf_access_logs (patient_id, actor_id, report_id, action, request_id)
    values (report.patient_id, actor, report.id, log_action, p_request_id);
  return report.storage_path;
end;
$$;

create function endo_private.stage_delete_cgm_pdf_reports(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); consent public.patient_cgm_consents;
  existing_event public.patient_cgm_consent_events; paths jsonb; count_reports integer;
begin
  if actor is null or p_request_id is null then raise exception 'Invalid report deletion request' using errcode = '22023'; end if;
  select * into existing_event from public.patient_cgm_consent_events
    where patient_id = actor and request_id = p_request_id;
  if found then
    if existing_event.action <> 'data_deleted' or existing_event.source_key <> 'libreview_pdf' then
      raise exception 'Deletion request identity was reused' using errcode = 'PT409';
    end if;
    return jsonb_build_object('paths', '[]'::jsonb, 'count', existing_event.rows_affected, 'already_deleted', true);
  end if;
  select * into consent from public.patient_cgm_consents
    where patient_id = actor and source_key = 'libreview_pdf' for update;
  if not found then raise insufficient_privilege using message = 'PDF consent record required'; end if;
  if exists (select 1 from public.patient_cgm_pdf_reports where patient_id = actor
    and deleted_at is not null and delete_request_id <> p_request_id) then
    raise exception 'Another report deletion is pending' using errcode = 'PT409';
  end if;
  update public.patient_cgm_pdf_reports set deleted_at = coalesce(deleted_at, now()), delete_request_id = p_request_id
    where patient_id = actor and deleted_at is null;
  select count(*), coalesce(jsonb_agg(storage_path), '[]'::jsonb) into count_reports, paths
    from public.patient_cgm_pdf_reports where patient_id = actor and delete_request_id = p_request_id;
  return jsonb_build_object('paths', paths, 'count', count_reports, 'already_deleted', false);
end;
$$;

create function endo_private.finalize_delete_cgm_pdf_reports(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); consent public.patient_cgm_consents;
  existing_event public.patient_cgm_consent_events; deleted_count integer;
begin
  if actor is null or p_request_id is null then raise exception 'Invalid report deletion request' using errcode = '22023'; end if;
  select * into existing_event from public.patient_cgm_consent_events
    where patient_id = actor and request_id = p_request_id;
  if found then
    if existing_event.action <> 'data_deleted' or existing_event.source_key <> 'libreview_pdf' then
      raise exception 'Deletion request identity was reused' using errcode = 'PT409';
    end if;
    return jsonb_build_object('deleted', existing_event.rows_affected);
  end if;
  select * into consent from public.patient_cgm_consents
    where patient_id = actor and source_key = 'libreview_pdf' for update;
  if not found then raise insufficient_privilege using message = 'PDF consent record required'; end if;
  select count(*) into deleted_count from public.patient_cgm_pdf_reports
    where patient_id = actor and delete_request_id = p_request_id;
  if exists (select 1 from public.patient_cgm_pdf_reports where patient_id = actor
    and delete_request_id = p_request_id and deleted_at is null) then
    raise exception 'Report deletion was not staged' using errcode = '22023';
  end if;
  delete from public.patient_cgm_pdf_reports where patient_id = actor and delete_request_id = p_request_id;
  insert into public.patient_cgm_consent_events
    (patient_id, source_key, consent_version, action, request_id, rows_affected)
    values (actor, 'libreview_pdf', consent.consent_version, 'data_deleted', p_request_id, deleted_count);
  return jsonb_build_object('deleted', deleted_count);
end;
$$;

create function public.endo_register_cgm_pdf_report(
  p_actor_id uuid, p_report_id uuid, p_request_id uuid, p_storage_path text,
  p_parser_version text, p_parse_status text, p_metrics jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$ begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise insufficient_privilege using message = 'Authenticated account changed';
  end if;
  return endo_private.cgm_register_pdf_report(
    p_report_id, p_request_id, p_storage_path, p_parser_version, p_parse_status, p_metrics
  );
end; $$;

create function public.endo_doctor_cgm_pdf_page(p_actor_id uuid, p_patient_id uuid, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$ begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise insufficient_privilege using message = 'Authenticated account changed';
  end if;
  return endo_private.doctor_cgm_pdf_page(p_patient_id, p_request_id);
end; $$;

create function public.endo_authorize_cgm_pdf_file_access(
  p_actor_id uuid, p_report_id uuid, p_request_id uuid, p_action text
)
returns text language plpgsql security invoker set search_path = '' as $$ begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise insufficient_privilege using message = 'Authenticated account changed';
  end if;
  return endo_private.authorize_cgm_pdf_file(p_report_id, p_request_id, p_action);
end; $$;

create function public.endo_stage_delete_cgm_pdf_reports(p_actor_id uuid, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$ begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise insufficient_privilege using message = 'Authenticated account changed';
  end if;
  return endo_private.stage_delete_cgm_pdf_reports(p_request_id);
end; $$;

create function public.endo_finalize_delete_cgm_pdf_reports(p_actor_id uuid, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$ begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise insufficient_privilege using message = 'Authenticated account changed';
  end if;
  return endo_private.finalize_delete_cgm_pdf_reports(p_request_id);
end; $$;

do $$
declare signature text;
begin
  foreach signature in array array[
    'endo_private.require_cgm_pdf_doctor_access(uuid)',
    'endo_private.cgm_register_pdf_report(uuid,uuid,text,text,text,jsonb)',
    'endo_private.doctor_cgm_pdf_page(uuid,uuid)',
    'endo_private.authorize_cgm_pdf_file(uuid,uuid,text)',
    'endo_private.stage_delete_cgm_pdf_reports(uuid)',
    'endo_private.finalize_delete_cgm_pdf_reports(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    if signature <> 'endo_private.require_cgm_pdf_doctor_access(uuid)' then
      execute format('grant execute on function %s to authenticated', signature);
    end if;
  end loop;
  foreach signature in array array[
    'public.endo_register_cgm_pdf_report(uuid,uuid,uuid,text,text,text,jsonb)',
    'public.endo_doctor_cgm_pdf_page(uuid,uuid,uuid)',
    'public.endo_authorize_cgm_pdf_file_access(uuid,uuid,uuid,text)',
    'public.endo_stage_delete_cgm_pdf_reports(uuid,uuid)',
    'public.endo_finalize_delete_cgm_pdf_reports(uuid,uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to authenticated', signature);
  end loop;
end;
$$;
