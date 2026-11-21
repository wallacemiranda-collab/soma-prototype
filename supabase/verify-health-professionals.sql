-- Synthetic identities only. Nothing from this test is retained.
begin;
do $$
declare
  patient_a uuid := gen_random_uuid();
  patient_b uuid := gen_random_uuid();
  physician_a uuid := gen_random_uuid();
  physician_b uuid := gen_random_uuid();
  nutritionist uuid := gen_random_uuid();
  psychologist uuid := gen_random_uuid();
  member uuid;
  member_council text;
  code text;
  n integer;
  identity jsonb;
begin
  if has_function_privilege('anon', 'public.endo_lookup_professional(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.endo_my_professionals()', 'EXECUTE') then
    raise exception 'Anonymous professional access enabled';
  end if;
  if has_column_privilege('authenticated', 'public.doctor_profiles', 'profession', 'UPDATE')
     or has_column_privilege('authenticated', 'public.doctor_profiles', 'council', 'UPDATE') then
    raise exception 'Professional identity is mutable';
  end if;
  insert into auth.users (id, aud, role, email, raw_user_meta_data)
  select id, 'authenticated', 'authenticated', 'endo-team-' || id || '@example.invalid',
    jsonb_build_object('full_name', 'Synthetic health team account')
  from unnest(array[patient_a,patient_b,physician_a,physician_b,nutritionist,psychologist]) id;
  insert into public.metabolic_entries (user_id, entry_date, weight_kg)
    values (patient_a, current_date, 80), (patient_b, current_date, 90);
  insert into public.habit_logs (user_id, logged_at, habit_key, value)
    values (patient_a, current_date, 'sleep', 1);

  begin
    insert into public.doctor_profiles (user_id, professional_name, profession, council, crm, crm_state)
      values (patient_b, 'Invalid registration', '', 'CRN', '12345', 'SP');
    raise exception 'Blank profession accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.doctor_profiles (user_id, professional_name, profession, council, crm, crm_state)
      values (patient_b, 'Invalid registration', 'Nutrição', '<CRN>', '12345', 'SP');
    raise exception 'Invalid council accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.doctor_profiles (user_id, professional_name, profession, council, crm, crm_state)
      values (patient_b, 'Invalid registration', 'Medicina', 'CRM', 'ABC', 'SP');
    raise exception 'Invalid CRM accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.doctor_profiles (user_id, professional_name, profession, council, crm, crm_state)
      values (patient_b, 'Invalid registration', 'Nutrição', 'CRN', '123@45', 'SP');
    raise exception 'Invalid registration number accepted';
  exception when check_violation then null;
  end;

  foreach member in array array[physician_a,physician_b,nutritionist,psychologist] loop
    perform set_config('request.jwt.claim.sub', member::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub',member,'role','authenticated')::text, true);
    execute 'set local role authenticated';
    if member in (physician_a, physician_b) then
      -- Old clients can still omit the new columns.
      insert into public.doctor_profiles (user_id, professional_name, crm, crm_state)
      values (member, 'Synthetic physician', '12345', 'SP');
      select count(*) into n from public.doctor_profiles where user_id = member and profession = 'Medicina' and council = 'CRM';
      if n <> 1 then raise exception 'Legacy physician identity changed'; end if;
    else
      insert into public.doctor_profiles (user_id, professional_name, profession, council, crm, crm_state)
      values (member, 'Synthetic health professional',
        case when member = nutritionist then 'Nutrição' else 'Psicologia' end,
        case when member = nutritionist then 'CRN' else 'CRP' end,
        case when member = nutritionist then '12345/N' else '06/12345' end, 'SP');
    end if;
    select count(*) into n from public.metabolic_entries where user_id = patient_a;
    if n <> 0 then raise exception 'Code or registration automatically granted access'; end if;
    begin
      update public.doctor_profiles set council = 'CRM' where user_id = member;
      raise exception 'Registered council can be changed';
    exception when insufficient_privilege then null;
    end;
    begin
      update public.doctor_profiles set profession = 'Other' where user_id = member;
      raise exception 'Registered profession can be changed';
    exception when insufficient_privilege then null;
    end;
    execute 'reset role';
  end loop;

  perform set_config('request.jwt.claim.sub', patient_a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient_a,'role','authenticated')::text, true);
  foreach member in array array[physician_a,physician_b,nutritionist,psychologist] loop
    select share_code, council into code, member_council from public.doctor_profiles where user_id = member;
    execute 'set local role authenticated';
    select to_jsonb(p) into identity from public.endo_lookup_professional(lower(code)) p;
    if identity is null or identity->>'council' <> member_council or identity ? 'email' or identity ? 'verified' then
      raise exception 'Professional lookup has incorrect identity or excessive data';
    end if;
    perform public.endo_grant_doctor_access(member, 30);
    execute 'reset role';
  end loop;
  execute 'set local role authenticated';
  perform public.endo_grant_doctor_access(physician_a, 7);
  select count(*) into n from public.endo_my_professionals();
  if n <> 4 then raise exception 'Multiple professionals replaced or duplicated each other'; end if;
  execute 'reset role';

  foreach member in array array[physician_a,physician_b,nutritionist,psychologist] loop
    perform set_config('request.jwt.claim.sub', member::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub',member,'role','authenticated')::text, true);
    execute 'set local role authenticated';
    if not public.endo_can_read_patient(patient_a) or public.endo_can_read_patient(patient_b) then
      raise exception 'Health professional sharing is not isolated';
    end if;
    select count(*) into n from public.endo_my_patients();
    if n <> 1 then raise exception 'Health professional patient list is incorrect'; end if;
    select count(*) into n from public.metabolic_entries where user_id = patient_a;
    if n <> 1 then raise exception 'Authorized measures inaccessible'; end if;
    select count(*) into n from public.habit_logs where user_id = patient_a;
    if n <> 1 then raise exception 'Authorized habits inaccessible'; end if;
    select to_jsonb(p) into identity from public.endo_shared_profile(patient_a) p;
    if identity is null or identity ? 'email' then raise exception 'Invalid shared profile'; end if;
    select count(*) into n from public.profiles where id = patient_a;
    if n <> 0 then raise exception 'Full patient profile exposed'; end if;
    update public.metabolic_entries set weight_kg = 1 where user_id = patient_a;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'Health professional changed patient measures'; end if;
    execute 'reset role';
  end loop;

  perform set_config('request.jwt.claim.sub', patient_b::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient_b,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.endo_my_professionals();
  if n <> 0 then raise exception 'Another patient can see the health team'; end if;
  perform public.endo_revoke_doctor_access(nutritionist);
  execute 'reset role';
  if exists(select 1 from public.patient_shares where patient_id = patient_a and revoked_at is not null) then
    raise exception 'Another patient revoked an authorization';
  end if;

  perform set_config('request.jwt.claim.sub', patient_a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient_a,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.endo_revoke_doctor_access(nutritionist);
  execute 'reset role';
  update public.patient_shares set granted_at = now() - interval '2 days', expires_at = now() - interval '1 day'
    where patient_id = patient_a and doctor_id = psychologist;
  foreach member in array array[physician_a,physician_b,nutritionist,psychologist] loop
    perform set_config('request.jwt.claim.sub', member::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub',member,'role','authenticated')::text, true);
    execute 'set local role authenticated';
    if public.endo_can_read_patient(patient_a) <> (member in (physician_a,physician_b)) then
      raise exception 'Revocation or expiry affected the wrong professional';
    end if;
    execute 'reset role';
  end loop;
end;
$$;
rollback;
select 'health_professionals_passed' as result;
