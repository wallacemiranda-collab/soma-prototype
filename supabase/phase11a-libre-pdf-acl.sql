-- Keep the public API invoker-scoped, matching the rest of this project.
create or replace function public.endo_register_cgm_pdf_report(
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

create or replace function public.endo_doctor_cgm_pdf_page(
  p_actor_id uuid, p_patient_id uuid, p_request_id uuid
)
returns jsonb language plpgsql security invoker set search_path = '' as $$ begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise insufficient_privilege using message = 'Authenticated account changed';
  end if;
  return endo_private.doctor_cgm_pdf_page(p_patient_id, p_request_id);
end; $$;

create or replace function public.endo_authorize_cgm_pdf_file_access(
  p_actor_id uuid, p_report_id uuid, p_request_id uuid, p_action text
)
returns text language plpgsql security invoker set search_path = '' as $$ begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise insufficient_privilege using message = 'Authenticated account changed';
  end if;
  return endo_private.authorize_cgm_pdf_file(p_report_id, p_request_id, p_action);
end; $$;

create or replace function public.endo_stage_delete_cgm_pdf_reports(
  p_actor_id uuid, p_request_id uuid
)
returns jsonb language plpgsql security invoker set search_path = '' as $$ begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise insufficient_privilege using message = 'Authenticated account changed';
  end if;
  return endo_private.stage_delete_cgm_pdf_reports(p_request_id);
end; $$;

create or replace function public.endo_finalize_delete_cgm_pdf_reports(
  p_actor_id uuid, p_request_id uuid
)
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
    'endo_private.require_cgm_pdf_doctor_access(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
  end loop;
  foreach signature in array array[
    'endo_private.cgm_register_pdf_report(uuid,uuid,text,text,text,jsonb)',
    'endo_private.doctor_cgm_pdf_page(uuid,uuid)',
    'endo_private.authorize_cgm_pdf_file(uuid,uuid,text)',
    'endo_private.stage_delete_cgm_pdf_reports(uuid)',
    'endo_private.finalize_delete_cgm_pdf_reports(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to authenticated', signature);
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
