-- Only synthetic accounts are used. The entire fixture is rolled back.
begin;
do $$
declare
  patient_a uuid := gen_random_uuid();
  patient_b uuid := gen_random_uuid();
  doctor_a uuid := gen_random_uuid();
  doctor_b uuid := gen_random_uuid();
  code_a text;
  n integer;
  shared jsonb;
begin
  if has_table_privilege('anon', 'public.doctor_profiles', 'SELECT')
     or has_table_privilege('anon', 'public.patient_shares', 'SELECT') then
    raise exception 'Anonymous sharing access is enabled';
  end if;
  if has_function_privilege('anon', 'public.endo_my_patients()', 'EXECUTE')
     or has_function_privilege('anon', 'public.endo_shared_profile(uuid)', 'EXECUTE') then
    raise exception 'Anonymous sharing RPC access is enabled';
  end if;
  insert into auth.users (id, aud, role, email, raw_user_meta_data)
  select id, 'authenticated', 'authenticated', 'endo-sharing-' || id || '@example.invalid',
    jsonb_build_object('full_name', 'Synthetic sharing account')
  from unnest(array[patient_a,patient_b,doctor_a,doctor_b]) id;
  insert into public.metabolic_entries (user_id, entry_date, weight_kg)
    values (patient_a, current_date, 80), (patient_b, current_date, 90);
  insert into public.habit_logs (user_id, logged_at, habit_key, value)
    values (patient_a, current_date, 'sleep', 1), (patient_b, current_date, 'sleep', 1);

  perform set_config('request.jwt.claim.sub', doctor_a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',doctor_a,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.doctor_profiles (user_id, professional_name, crm, crm_state)
    values (doctor_a, 'Synthetic doctor A', '12345', 'SP') returning share_code into code_a;
  if code_a !~ '^[A-F0-9]{16}$' then raise exception 'Invalid generated code'; end if;
  select count(*) into n from public.metabolic_entries where user_id = patient_a;
  if n <> 0 then raise exception 'Unshared patient is readable'; end if;
  begin
    insert into public.patient_shares (patient_id, doctor_id) values (patient_a, doctor_a);
    raise exception 'Doctor created a sharing authorization directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.doctor_profiles set crm = '99999' where user_id = doctor_a;
    raise exception 'Professional identity changed after registration';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', doctor_b::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',doctor_b,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.doctor_profiles (user_id, professional_name, crm, crm_state)
    values (doctor_b, 'Synthetic doctor B', '54321', 'RJ');
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', patient_a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient_a,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.doctor_profiles;
  if n <> 0 then raise exception 'Global doctor directory is readable'; end if;
  select count(*) into n from public.endo_lookup_doctor(code_a);
  if n <> 1 then raise exception 'Exact code lookup failed'; end if;
  perform public.endo_grant_doctor_access(doctor_a, 30);
  perform public.endo_grant_doctor_access(doctor_b, null);
  perform public.endo_grant_doctor_access(doctor_a, 7);
  select count(*) into n from public.endo_my_doctors();
  if n <> 2 then raise exception 'Multiple doctors or renewal failed'; end if;
  begin
    perform public.endo_grant_doctor_access(doctor_a, -1);
    raise exception 'Invalid sharing duration accepted';
  exception when invalid_parameter_value then null;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', doctor_a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',doctor_a,'role','authenticated','user_metadata',jsonb_build_object('role','admin'))::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.endo_my_patients();
  if n <> 1 then raise exception 'Doctor patient list is not isolated'; end if;
  select count(*) into n from public.metabolic_entries where user_id = patient_a;
  if n <> 1 then raise exception 'Authorized measures are inaccessible'; end if;
  select count(*) into n from public.habit_logs where user_id = patient_a;
  if n <> 1 then raise exception 'Authorized habits are inaccessible'; end if;
  select count(*) into n from public.metabolic_entries where user_id = patient_b;
  if n <> 0 then raise exception 'Unrelated patient data leaked'; end if;
  select count(*) into n from public.profiles where id = patient_a;
  if n <> 0 then raise exception 'Full profile including email is exposed to doctor'; end if;
  select to_jsonb(p) into shared from public.endo_shared_profile(patient_a) p;
  if shared is null or shared ? 'email' then raise exception 'Invalid shared profile shape'; end if;
  update public.metabolic_entries set weight_kg = 1 where user_id = patient_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Doctor modified a patient record'; end if;
  begin
    perform public.endo_shared_profile(patient_b);
    raise exception 'Guessed patient profile was accessible';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', patient_b::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient_b,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.endo_revoke_doctor_access(doctor_a);
  select count(*) into n from public.patient_shares where patient_id = patient_a;
  if n <> 0 then raise exception 'Another patient sharing is visible'; end if;
  execute 'reset role';
  if not exists(select 1 from public.patient_shares where patient_id=patient_a and doctor_id=doctor_a and revoked_at is null) then
    raise exception 'Another patient revoked access';
  end if;

  perform set_config('request.jwt.claim.sub', patient_a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient_a,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.endo_revoke_doctor_access(doctor_a);
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', doctor_a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',doctor_a,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  if public.endo_can_read_patient(patient_a) then raise exception 'Revoked access remains valid'; end if;
  select count(*) into n from public.metabolic_entries where user_id = patient_a;
  if n <> 0 then raise exception 'Revoked measurements remain visible'; end if;
  select count(*) into n from public.endo_my_patients();
  if n <> 0 then raise exception 'Revoked patient remains listed'; end if;
  begin
    perform public.endo_shared_profile(patient_a);
    raise exception 'Revoked profile remains visible';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', doctor_b::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',doctor_b,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  if not public.endo_can_read_patient(patient_a) then raise exception 'Independent authorization was revoked'; end if;
  execute 'reset role';
  update public.patient_shares set granted_at = now() - interval '2 days', expires_at = now() - interval '1 day'
    where patient_id = patient_a and doctor_id = doctor_b;
  execute 'set local role authenticated';
  if public.endo_can_read_patient(patient_a) then raise exception 'Expired access remains valid'; end if;
  select count(*) into n from public.habit_logs where user_id = patient_a;
  if n <> 0 then raise exception 'Expired habits remain readable'; end if;
  execute 'reset role';
end;
$$;
rollback;
select 'doctor_sharing_passed' as result;
