begin;
do $$
declare
  patient uuid := gen_random_uuid();
  doctor uuid := gen_random_uuid();
  nutritionist uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid();
  activation_request uuid := gen_random_uuid();
  config_request uuid := gen_random_uuid();
  clinical_access_request uuid := gen_random_uuid();
  profile_page jsonb;
  entry_page jsonb;
  habit_page jsonb;
  clinical_page jsonb;
  visible integer;
  access_count integer;
  module_version uuid;
  history_row record;
begin
  if has_table_privilege('anon', 'public.patient_access_logs', 'SELECT')
    or has_table_privilege('anon', 'public.patient_access_logs', 'INSERT') then
    raise exception 'Anonymous access to patient access history is enabled';
  end if;
  if has_function_privilege('anon', 'public.endo_audited_patient_page(uuid,text,integer,integer,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.endo_patient_access_history(integer,integer)', 'EXECUTE') then
    raise exception 'Anonymous access to privacy RPCs is enabled';
  end if;

  insert into auth.users (id, aud, role, email, raw_user_meta_data)
  values
    (patient, 'authenticated', 'authenticated', 'privacy-patient-' || patient || '@example.invalid', '{"full_name":"Synthetic patient"}'),
    (doctor, 'authenticated', 'authenticated', 'privacy-doctor-' || doctor || '@example.invalid', '{"full_name":"Synthetic doctor"}'),
    (nutritionist, 'authenticated', 'authenticated', 'privacy-nutritionist-' || nutritionist || '@example.invalid', '{"full_name":"Synthetic nutritionist"}');

  insert into public.doctor_profiles (user_id, professional_name, crm, crm_state)
    values (doctor, 'Synthetic professional', '12345', 'SP');
  insert into public.doctor_profiles (user_id, professional_name, profession, council, crm, crm_state)
    values (nutritionist, 'Synthetic nutritionist', 'Nutrição', 'CRN', '12345', 'SP');
  insert into public.patient_shares (patient_id, doctor_id)
    values (patient, doctor);
  insert into public.metabolic_entries (user_id, entry_date, weight_kg)
    values (patient, current_date, 75);
  insert into public.habit_logs (user_id, logged_at, habit_key, value)
    values (patient, current_date, 'sleep', 1);

  perform set_config('request.jwt.claim.sub', doctor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',doctor,'role','authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into visible from public.metabolic_entries where user_id = patient;
  if visible <> 0 then raise exception 'Unaudited direct measurement read is still possible'; end if;
  select count(*) into visible from public.habit_logs where user_id = patient;
  if visible <> 0 then raise exception 'Unaudited direct habit read is still possible'; end if;
  select count(*) into visible from public.profiles where id = patient;
  if visible <> 0 then raise exception 'Unaudited direct profile read is still possible'; end if;
  select count(*) into visible from public.patient_access_logs;
  if visible <> 0 then raise exception 'A professional can read the patient access log'; end if;

  profile_page := public.endo_audited_patient_page(patient, 'profile', 0, 500, request_id);
  entry_page := public.endo_audited_patient_page(patient, 'entries', 0, 500, request_id);
  habit_page := public.endo_audited_patient_page(patient, 'habits', 0, 500, request_id);
  if jsonb_array_length(profile_page) <> 1 or profile_page->0 ? 'email' then
    raise exception 'Audited profile RPC returned an invalid profile';
  end if;
  if jsonb_array_length(entry_page) <> 1 or jsonb_array_length(habit_page) <> 1 then
    raise exception 'Audited history RPC did not return the authorized patient history';
  end if;
  select count(*) into visible from public.endo_patient_access_history(50);
  if visible <> 0 then raise exception 'A professional can read their own copy of the patient log'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', patient::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select * into history_row from public.endo_patient_access_history(50);
  if not found or history_row.professional_name <> 'Synthetic professional' then
    raise exception 'Patient cannot see the professional access history';
  end if;
  if not ('profile' = any(history_row.scopes) and 'measurements' = any(history_row.scopes)
      and 'habits' = any(history_row.scopes)) then
    raise exception 'Pagination pages were not grouped in one access event';
  end if;
  begin
    insert into public.patient_access_logs (patient_id, doctor_id, access_request_id, scopes)
      values (patient, doctor, gen_random_uuid(), array['clinical']);
    raise exception 'A patient forged an access history row';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  update public.patient_access_logs
    set accessed_at = now() - interval '6 minutes'
    where patient_id = patient and doctor_id = doctor
      and access_request_id = request_id;
  perform set_config('request.jwt.claim.sub', doctor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',doctor,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.endo_audited_patient_page(patient, 'entries', 0, 1, request_id);
  execute 'reset role';
  select count(*) into access_count from public.patient_access_logs
    where patient_id = patient and doctor_id = doctor
      and access_request_id = request_id;
  if access_count <> 2 then
    raise exception 'Reusing an old request ID hid a later patient consultation';
  end if;

  perform set_config('request.jwt.claim.sub', patient::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.endo_grant_doctor_access(nutritionist, 30);
  perform public.endo_grant_clinical_activation(patient, doctor, activation_request, true);
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', doctor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',doctor,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select (public.endo_configure_clinical_module(
    doctor, patient, 'diabetes', null, config_request, '{"low":80,"high":180}'::jsonb
  )->>'id')::uuid into module_version;
  execute 'reset role';
  insert into public.glucose_readings
    (patient_id, module_version_id, request_id, occurred_at, time_zone, value, context)
  values (patient, module_version, gen_random_uuid(), now() - interval '1 hour', 'America/Sao_Paulo', 120, 'fasting');

  perform set_config('request.jwt.claim.sub', nutritionist::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',nutritionist,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into visible from public.glucose_readings where patient_id = patient;
  if visible <> 0 then raise exception 'Clinical direct reads bypassed the audit RPC'; end if;
  clinical_page := public.endo_doctor_clinical_page(
    patient, 'glucose_readings', 0, 500, clinical_access_request
  );
  if jsonb_array_length(clinical_page) <> 1 then
    raise exception 'A nonmedical professional with patient consent could not read an active clinical module';
  end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', patient::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.endo_revoke_doctor_access(nutritionist);
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', nutritionist::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',nutritionist,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.endo_doctor_clinical_page(
      patient, 'glucose_readings', 0, 500, gen_random_uuid()
    );
    raise exception 'A revoked professional could still read clinical data';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', patient::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.endo_revoke_doctor_access(doctor);
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', doctor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',doctor,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.endo_audited_patient_page(patient, 'profile', 0, 1, gen_random_uuid());
    raise exception 'A revoked professional could still read the profile';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  delete from auth.users where id = doctor;
  perform set_config('request.jwt.claim.sub', patient::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into access_count from public.endo_patient_access_history(50)
    where professional_name = 'Synthetic professional';
  if access_count = 0 then
    raise exception 'Deleting a professional erased the patient access history';
  end if;
  execute 'reset role';
end;
$$;
rollback;
select 'privacy_access_logs_passed' as result;
