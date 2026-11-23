begin;
do $$
declare
  patient uuid := gen_random_uuid();
  doctor uuid := gen_random_uuid();
  second_doctor uuid := gen_random_uuid();
  nutritionist uuid := gen_random_uuid();
  stranger uuid := gen_random_uuid();
  access_request uuid := gen_random_uuid();
  result_row jsonb;
  patient_rows jsonb;
  doctor_rows jsonb;
  revoke_response jsonb;
  visible integer;
begin
  if not exists (
    select 1 from pg_catalog.pg_index i
    where i.indexrelid = 'public.calculator_results_created_by_idx'::regclass
      and i.indisvalid
  ) then
    raise exception 'The calculation creator foreign key is not indexed';
  end if;
  if has_table_privilege('anon', 'public.calculator_results', 'SELECT')
    or has_table_privilege('authenticated', 'public.calculator_results', 'SELECT')
    or has_table_privilege('authenticated', 'public.calculator_results', 'INSERT')
    or has_table_privilege('authenticated', 'public.calculator_results', 'UPDATE') then
    raise exception 'Direct API access to calculator results is enabled';
  end if;
  if has_function_privilege('anon', 'public.endo_save_fib4_result(uuid,uuid,integer,numeric,numeric,numeric,date)', 'EXECUTE')
    or has_function_privilege('anon', 'public.endo_doctor_calculator_results(uuid,integer,integer,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.endo_patient_calculator_results(integer,integer)', 'EXECUTE')
    or has_function_privilege('anon', 'public.endo_set_calculator_result_visibility(uuid,boolean)', 'EXECUTE') then
    raise exception 'Anonymous access to calculator functions is enabled';
  end if;

  insert into auth.users (id, aud, role, email, raw_user_meta_data)
  values
    (patient, 'authenticated', 'authenticated', 'fib4-patient-' || patient || '@example.invalid', '{"full_name":"Synthetic patient"}'),
    (doctor, 'authenticated', 'authenticated', 'fib4-doctor-' || doctor || '@example.invalid', '{"full_name":"Synthetic doctor"}'),
    (second_doctor, 'authenticated', 'authenticated', 'fib4-doctor-' || second_doctor || '@example.invalid', '{"full_name":"Synthetic second doctor"}'),
    (nutritionist, 'authenticated', 'authenticated', 'fib4-nutritionist-' || nutritionist || '@example.invalid', '{"full_name":"Synthetic nutritionist"}'),
    (stranger, 'authenticated', 'authenticated', 'fib4-stranger-' || stranger || '@example.invalid', '{"full_name":"Synthetic stranger"}');
  insert into public.doctor_profiles (user_id, professional_name, profession, council, crm, crm_state)
    values (doctor, 'Synthetic physician', 'Medicina', 'CRM', '12345', 'SP');
  insert into public.doctor_profiles (user_id, professional_name, profession, council, crm, crm_state)
    values (second_doctor, 'Synthetic second physician', 'Medicina', 'CRM', '54321', 'SP');
  insert into public.doctor_profiles (user_id, professional_name, profession, council, crm, crm_state)
    values (nutritionist, 'Synthetic nutritionist', 'Nutrição', 'CRN', '12345', 'SP');
  update public.profiles set birth_date = date '1981-01-01' where id = patient;
  insert into public.patient_shares (patient_id, doctor_id)
    values (patient, doctor), (patient, second_doctor), (patient, nutritionist);

  perform set_config('request.jwt.claim.sub', doctor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',doctor,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.endo_save_fib4_result(
      patient, access_request, 44, 110, 100, 99, current_date
    );
    raise exception 'A mismatched age was accepted for the patient profile';
  exception when sqlstate '22023' then null;
  end;
  result_row := public.endo_save_fib4_result(
    patient, access_request, 45, 110, 100, 99, current_date
  );
  if result_row->'result'->>'score' <> '5.00'
    or result_row->'result'->>'category' <> 'high'
    or result_row->>'shared_with_patient' <> 'false' then
    raise exception 'The FIB-4 example or private default is incorrect: %', result_row;
  end if;
  doctor_rows := public.endo_doctor_calculator_results(
    patient, 0, 100, gen_random_uuid()
  );
  if jsonb_array_length(doctor_rows) <> 1 then
    raise exception 'Authorized physician cannot read the calculation history';
  end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', second_doctor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',second_doctor,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  doctor_rows := public.endo_doctor_calculator_results(
    patient, 0, 100, gen_random_uuid()
  );
  if jsonb_array_length(doctor_rows) <> 0 then
    raise exception 'A second authorized physician saw another physician''s private result';
  end if;
  begin
    perform public.endo_set_calculator_result_visibility(
      (result_row->>'id')::uuid, true
    );
    raise exception 'A second physician shared another physician''s result';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', patient::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  patient_rows := public.endo_patient_calculator_results(0, 100);
  if jsonb_array_length(patient_rows) <> 0 then
    raise exception 'Private physician result is visible to the patient before sharing';
  end if;
  begin
    perform public.endo_set_calculator_result_visibility(
      (result_row->>'id')::uuid, true
    );
    raise exception 'Patient could publish a physician result without the physician';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', doctor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',doctor,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.endo_set_calculator_result_visibility(
    (result_row->>'id')::uuid, true
  );
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', patient::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  patient_rows := public.endo_patient_calculator_results(0, 100);
  if jsonb_array_length(patient_rows) <> 1
    or patient_rows->0 ? 'inputs'
    or patient_rows->0->'result'->>'score' <> '5.00' then
    raise exception 'Patient received missing or private calculation data: %', patient_rows;
  end if;
  revoke_response := public.endo_set_calculator_result_visibility(
    (result_row->>'id')::uuid, false
  );
  if revoke_response ? 'inputs'
    or (revoke_response - 'id' - 'shared_with_patient') <> '{}'::jsonb then
    raise exception 'Patient visibility response disclosed clinical inputs: %', revoke_response;
  end if;
  patient_rows := public.endo_patient_calculator_results(0, 100);
  if jsonb_array_length(patient_rows) <> 0 then
    raise exception 'Patient could not revoke result visibility';
  end if;
  select count(*) into visible from public.endo_patient_access_history(100, 0)
    where 'calculators' = any(scopes);
  if visible = 0 then raise exception 'Calculator reads were not audited'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', nutritionist::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',nutritionist,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.endo_doctor_calculator_results(
      patient, 0, 100, gen_random_uuid()
    );
    raise exception 'A non-physician accessed a physician-only calculator';
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
    perform public.endo_doctor_calculator_results(
      patient, 0, 100, gen_random_uuid()
    );
    raise exception 'A revoked physician could still read calculations';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', stranger::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',stranger,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.endo_doctor_calculator_results(
      patient, 0, 100, gen_random_uuid()
    );
    raise exception 'An unauthorized account could read the calculations';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end;
$$;
rollback;
select 'phase7_fib4_privacy_passed' as result;
