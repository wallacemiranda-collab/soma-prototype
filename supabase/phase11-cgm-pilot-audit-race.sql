create or replace function endo_private.doctor_cgm_page(
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
