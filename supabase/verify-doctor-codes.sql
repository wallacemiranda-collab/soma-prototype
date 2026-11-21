-- Only synthetic accounts and records are touched; all changes are rolled back.
begin;
do $$
declare
  doctor_a uuid := gen_random_uuid();
  doctor_b uuid := gen_random_uuid();
  patient uuid := gen_random_uuid();
  suffix text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  custom_code text := 'TESTA' || suffix;
  other_code text := 'TESTB' || suffix;
  old_code text;
  invalid_code text;
  n integer;
begin
  if not has_column_privilege('authenticated', 'public.doctor_profiles', 'share_code', 'UPDATE') then
    raise exception 'Code editing is unavailable';
  end if;
  if has_column_privilege('authenticated', 'public.doctor_profiles', 'crm', 'UPDATE')
    or has_column_privilege('authenticated', 'public.doctor_profiles', 'user_id', 'UPDATE')
    or has_column_privilege('anon', 'public.doctor_profiles', 'share_code', 'UPDATE')
    or has_table_privilege('authenticated', 'endo_private.doctor_code_reservations', 'SELECT') then
    raise exception 'Excessive code editing privileges';
  end if;
  insert into auth.users (id, aud, role, email, raw_user_meta_data)
  select id, 'authenticated', 'authenticated', 'endo-code-' || id || '@example.invalid',
    '{"full_name":"Synthetic code test"}'::jsonb
  from unnest(array[doctor_a, doctor_b, patient]) id;
  insert into public.doctor_profiles (user_id, professional_name, crm, crm_state)
    values (doctor_a, 'Synthetic doctor A', '12345', 'SP'),
           (doctor_b, 'Synthetic doctor B', '54321', 'RJ');
  select share_code into old_code from public.doctor_profiles where user_id = doctor_a;
  insert into public.metabolic_entries (user_id, entry_date, weight_kg) values (patient, current_date, 80);
  perform set_config('request.jwt.claim.sub', patient::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.endo_grant_doctor_access(doctor_a, 30);
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', doctor_a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',doctor_a,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  update public.doctor_profiles set share_code = custom_code where user_id = doctor_a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Own code could not be changed'; end if;
  if not public.endo_can_read_patient(patient) then raise exception 'Code editing broke existing patient access'; end if;
  select count(*) into n from public.endo_my_patients();
  if n <> 1 then raise exception 'Patient list changed with code'; end if;
  select count(*) into n from public.endo_lookup_doctor(lower('TEST-A' || suffix));
  if n <> 1 then raise exception 'Personalized lookup normalization failed'; end if;
  select count(*) into n from public.endo_lookup_doctor(old_code);
  if n <> 0 then raise exception 'Retired code remains searchable'; end if;
  update public.doctor_profiles set share_code = other_code where user_id = doctor_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Another doctor code was changed'; end if;
  begin
    update public.doctor_profiles set crm = '99999' where user_id = doctor_a;
    raise exception 'CRM became editable';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from endo_private.doctor_code_reservations;
    raise exception 'Private reservations are readable';
  exception when insufficient_privilege then null;
  end;
  update public.metabolic_entries set weight_kg = 1 where user_id = patient;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Code editing granted clinical write access'; end if;
  foreach invalid_code in array array['ABC', 'lowercase', repeat('A',25), 'HAS_SPACE ', 'HAS_SYMBOL!'] loop
    begin
      update public.doctor_profiles set share_code = invalid_code where user_id = doctor_a;
      raise exception 'Invalid code accepted';
    exception when check_violation then null;
    end;
  end loop;
  update public.doctor_profiles set share_code = old_code where user_id = doctor_a;
  update public.doctor_profiles set share_code = custom_code where user_id = doctor_a;
  execute 'reset role';
  select count(*) into n from endo_private.doctor_code_reservations where doctor_id = doctor_a;
  if n <> 2 then raise exception 'Code reservations duplicated'; end if;

  perform set_config('request.jwt.claim.sub', doctor_b::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',doctor_b,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    update public.doctor_profiles set share_code = custom_code where user_id = doctor_b;
    raise exception 'Active code takeover succeeded';
  exception when unique_violation then null;
  end;
  begin
    update public.doctor_profiles set share_code = old_code where user_id = doctor_b;
    raise exception 'Retired code takeover succeeded';
  exception when unique_violation then null;
  end;
  select count(*) into n from public.endo_my_patients();
  if n <> 0 then raise exception 'Code attempt inherited patient authorization'; end if;
  execute 'reset role';
  delete from auth.users where id = doctor_a;
  if not exists(select 1 from endo_private.doctor_code_reservations where code = custom_code and doctor_id is null) then
    raise exception 'Deleted account code was released';
  end if;
  execute 'set local role authenticated';
  begin
    update public.doctor_profiles set share_code = custom_code where user_id = doctor_b;
    raise exception 'Deleted account code takeover succeeded';
  exception when unique_violation then null;
  end;
  execute 'reset role';
end;
$$;
rollback;
select 'custom_doctor_codes_passed' as result;
