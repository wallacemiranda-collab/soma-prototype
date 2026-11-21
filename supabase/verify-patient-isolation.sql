-- Synthetic fixtures are rolled back, including their auth users and profiles.
begin;
do $$
declare
  patient_a uuid := gen_random_uuid();
  patient_b uuid := gen_random_uuid();
  row_count integer;
  relation_name text;
  privilege_name text;
begin
  foreach relation_name in array array['public.profiles', 'public.metabolic_entries', 'public.habit_logs'] loop
    foreach privilege_name in array array['DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
      if has_table_privilege('authenticated', relation_name, privilege_name) then
        raise exception 'Authenticated role has excessive privilege % on %', privilege_name, relation_name;
      end if;
    end loop;
    foreach privilege_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
      if has_table_privilege('anon', relation_name, privilege_name) then
        raise exception 'Anonymous role can access %', relation_name;
      end if;
    end loop;
  end loop;

  insert into auth.users (id, aud, role, email, raw_user_meta_data)
  values
    (patient_a, 'authenticated', 'authenticated', 'endo-test-' || patient_a || '@example.invalid', '{"full_name":"Teste técnico A"}'::jsonb),
    (patient_b, 'authenticated', 'authenticated', 'endo-test-' || patient_b || '@example.invalid', '{"full_name":"Teste técnico B"}'::jsonb);
  insert into public.metabolic_entries (user_id, entry_date, weight_kg)
  values (patient_a, current_date, 80), (patient_b, current_date, 81);
  insert into public.habit_logs (user_id, logged_at, habit_key, value)
  values (patient_a, current_date, 'sleep', 1), (patient_b, current_date, 'sleep', 1);

  perform set_config('request.jwt.claim.sub', patient_a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', patient_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into row_count from public.profiles where id = patient_b;
  if row_count <> 0 then raise exception 'Another profile is visible'; end if;
  select count(*) into row_count from public.metabolic_entries where user_id = patient_b;
  if row_count <> 0 then raise exception 'Another patient entry is visible'; end if;
  select count(*) into row_count from public.habit_logs where user_id = patient_b;
  if row_count <> 0 then raise exception 'Another patient habit is visible'; end if;

  update public.metabolic_entries set weight_kg = 79 where user_id = patient_b;
  get diagnostics row_count = row_count;
  if row_count <> 0 then raise exception 'Another patient entry was updated'; end if;

  update public.profiles
  set full_name = 'Not permitted', birth_date = date '1992-02-29', sex = 'female'
  where id = patient_b;
  get diagnostics row_count = row_count;
  if row_count <> 0 then raise exception 'Another profile was updated'; end if;
  update public.habit_logs set value = 0 where user_id = patient_b;
  get diagnostics row_count = row_count;
  if row_count <> 0 then raise exception 'Another patient habit was updated'; end if;

  begin
    insert into public.metabolic_entries (user_id, entry_date, weight_kg)
    values (patient_b, current_date - 1, 80);
    raise exception 'Another patient entry was inserted';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.profiles (id, full_name) values (patient_b, 'Not permitted')
    on conflict (id) do update set full_name = excluded.full_name;
    raise exception 'Another profile was overwritten';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.habit_logs (user_id, logged_at, habit_key, value)
    values (patient_b, current_date - 1, 'movement', 1);
    raise exception 'Another patient habit was inserted';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.metabolic_entries set user_id = patient_b where user_id = patient_a;
    raise exception 'A record was reassigned to another patient';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.habit_logs set user_id = patient_b where user_id = patient_a;
    raise exception 'A habit was reassigned to another patient';
  exception when insufficient_privilege then null;
  end;

  insert into public.metabolic_entries (user_id, entry_date, weight_kg)
  values (patient_a, current_date, 78)
  on conflict (user_id, entry_date) do update set weight_kg = excluded.weight_kg;
  select count(*) into row_count from public.metabolic_entries
  where user_id = patient_a and entry_date = current_date and weight_kg = 78;
  if row_count <> 1 then raise exception 'Own daily record could not be updated'; end if;
  update public.habit_logs set value = 0 where user_id = patient_a and habit_key = 'sleep';
  get diagnostics row_count = row_count;
  if row_count <> 1 then raise exception 'Own habit could not be updated'; end if;
  insert into public.habit_logs (user_id, logged_at, habit_key, value)
  values (patient_a, current_date, 'sleep', 1)
  on conflict (user_id, logged_at, habit_key) do update set value = excluded.value;
  select count(*) into row_count from public.habit_logs
  where user_id = patient_a and logged_at = current_date and habit_key = 'sleep' and value = 1;
  if row_count <> 1 then raise exception 'Habit upsert produced an unexpected record'; end if;
  insert into public.metabolic_entries (user_id, entry_date, activity_minutes, sleep_minutes)
  values (patient_a, current_date - 1, 0, 454);
  select count(*) into row_count from public.metabolic_entries where user_id = patient_a;
  if row_count <> 2 then raise exception 'Records on separate dates were not preserved'; end if;
  update public.profiles
  set full_name = 'Updated synthetic patient', goal_weight = null,
      birth_date = date '1992-02-29', sex = 'female'
  where id = patient_a;
  get diagnostics row_count = row_count;
  if row_count <> 1 then raise exception 'Own profile could not be updated'; end if;
  select count(*) into row_count from public.profiles
  where id = patient_a and birth_date = date '1992-02-29' and sex = 'female';
  if row_count <> 1 then raise exception 'Own personal details could not be read'; end if;
  begin
    update public.profiles set birth_date = current_date + 1 where id = patient_a;
    raise exception 'A future birth date was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.profiles set sex = 'invalid' where id = patient_a;
    raise exception 'An unsupported sex value was accepted';
  exception when check_violation then null;
  end;
  update public.profiles set birth_date = null, sex = null where id = patient_a;
  select count(*) into row_count from public.profiles
  where id = patient_a and birth_date is null and sex is null;
  if row_count <> 1 then raise exception 'Optional personal details could not be cleared'; end if;
  begin
    update public.metabolic_entries set mood_score = 11 where user_id = patient_a;
    raise exception 'An out-of-range measurement was accepted';
  exception when check_violation then null;
  end;
  execute 'reset role';
end;
$$;
rollback;
select 'patient_isolation_passed' as result;
