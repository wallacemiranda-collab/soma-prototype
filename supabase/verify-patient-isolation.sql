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

  begin
    insert into public.metabolic_entries (user_id, entry_date, weight_kg)
    values (patient_b, current_date - 1, 80);
    raise exception 'Another patient entry was inserted';
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
  execute 'reset role';
end;
$$;
rollback;
select 'patient_isolation_passed' as result;
