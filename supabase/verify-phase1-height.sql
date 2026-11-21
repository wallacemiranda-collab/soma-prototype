-- Requires phase1-height.sql. Uses only synthetic accounts, rolled back in full.
begin;
do $$
declare
  patient_a uuid := gen_random_uuid();
  patient_b uuid := gen_random_uuid();
  professional uuid := gen_random_uuid();
  n integer;
  height numeric;
  invalid_height numeric;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data)
  select id, 'authenticated', 'authenticated', 'endo-height-' || id || '@example.invalid',
    jsonb_build_object('full_name', 'Synthetic height account')
  from unnest(array[patient_a,patient_b,professional]) id;
  insert into public.metabolic_entries (user_id, entry_date, weight_kg)
    values (patient_a, current_date - 1, 70), (patient_b, current_date, 80);
  select count(*) into n from public.metabolic_entries
    where user_id in (patient_a,patient_b) and height_cm is null;
  if n <> 2 then raise exception 'Height was invented for legacy measurements'; end if;
  insert into public.doctor_profiles (user_id, professional_name, crm, crm_state)
    values (professional, 'Synthetic professional', '12345', 'SP');

  perform set_config('request.jwt.claim.sub', patient_a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient_a,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  update public.profiles set height_cm = 175 where id = patient_a;
  select height_cm into height from public.profiles where id = patient_a;
  if height is distinct from 175 then raise exception 'Own height did not save'; end if;
  select count(*) into n from public.metabolic_entries where user_id = patient_a and height_cm is null;
  if n <> 1 then raise exception 'Profile edit altered historical height'; end if;
  insert into public.metabolic_entries (user_id, entry_date, weight_kg, waist_cm, height_cm)
    values (patient_a, current_date, 70, 96.5, 175);
  foreach invalid_height in array array[0,-1,29.9,300.1,'NaN'::numeric] loop
    begin
      update public.profiles set height_cm = invalid_height where id = patient_a;
      raise exception 'Invalid profile height accepted';
    exception when check_violation then null;
    end;
    begin
      update public.metabolic_entries set height_cm = invalid_height where user_id = patient_a;
      raise exception 'Invalid height reference accepted';
    exception when check_violation then null;
    end;
  end loop;
  update public.profiles set height_cm = 180 where id = patient_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Another profile height can be changed'; end if;
  update public.metabolic_entries set height_cm = 180 where user_id = patient_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Another measurement height can be changed'; end if;
  update public.profiles set height_cm = null where id = patient_a;
  select height_cm into height from public.metabolic_entries where user_id = patient_a and entry_date = current_date;
  if height is distinct from 175 then raise exception 'Clearing profile rewrote the measurement reference'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', professional::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',professional,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.metabolic_entries where user_id = patient_a;
  if n <> 0 then raise exception 'Height was shared without authorization'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', patient_a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient_a,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.endo_grant_doctor_access(professional, 30);
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', professional::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',professional,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select height_cm into height from public.metabolic_entries where user_id = patient_a and entry_date = current_date;
  if height is distinct from 175 then raise exception 'Authorized height reference unreadable'; end if;
  update public.metabolic_entries set height_cm = 180 where user_id = patient_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Professional changed the height reference'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', patient_a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',patient_a,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.endo_revoke_doctor_access(professional);
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', professional::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',professional,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.metabolic_entries where user_id = patient_a;
  if n <> 0 then raise exception 'Revoked height reference still visible'; end if;
  execute 'reset role';
end;
$$;
rollback;
select 'phase1_height_passed' as result;
