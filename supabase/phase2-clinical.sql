-- Incremental Phase 2 preparation. NOT applied to the hosted project.
-- Existing patient data, sharing grants and professional identities are unchanged.
set local lock_timeout = '3s';

create table public.patient_module_permissions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  doctor_id uuid references public.doctor_profiles(user_id) on delete set null,
  share_granted_at timestamptz not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  consent_version text not null default 'endo-clinical-activation-v1'
    check (consent_version = 'endo-clinical-activation-v1'),
  request_id uuid not null,
  unique (patient_id, request_id),
  check (patient_id <> doctor_id)
);
create unique index clinical_one_active_permission
  on public.patient_module_permissions (patient_id, doctor_id) where revoked_at is null;
create index clinical_permission_doctor on public.patient_module_permissions (doctor_id, patient_id);

-- Even a same-timestamp renewal must never revive an old activation consent.
create function endo_private.clinical_invalidate_activation()
returns trigger language plpgsql security definer set search_path = '' as $$ begin
  update public.patient_module_permissions set revoked_at = now()
    where patient_id = old.patient_id and doctor_id = old.doctor_id and revoked_at is null;
  return null;
end $$;
create trigger clinical_sharing_changed after update or delete on public.patient_shares
  for each row execute function endo_private.clinical_invalidate_activation();

create table public.clinical_module_settings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null check (module_key in ('diabetes','glp1','thyroid','pressure')),
  doctor_id uuid references public.doctor_profiles(user_id) on delete set null,
  permission_id uuid not null references public.patient_module_permissions(id),
  enabled boolean not null default false,
  current_version_id uuid,
  unique (patient_id, module_key)
);
create index clinical_settings_permission on public.clinical_module_settings (permission_id);
create index clinical_settings_doctor on public.clinical_module_settings (doctor_id);

create table public.clinical_module_versions (
  id uuid primary key default gen_random_uuid(),
  setting_id uuid not null references public.clinical_module_settings(id) on delete cascade,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null check (module_key in ('diabetes','glp1','thyroid','pressure')),
  doctor_id uuid references public.doctor_profiles(user_id) on delete set null,
  revision integer not null check (revision > 0),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  glucose_low numeric,
  glucose_high numeric,
  medication text,
  dose_mg numeric,
  interval_days integer,
  anchor_date date,
  unique (setting_id, revision),
  unique (setting_id, request_id),
  unique (patient_id, module_key, id),
  check (case module_key
    when 'diabetes' then
      ((glucose_low is null and glucose_high is null) or
       (glucose_low is not null and glucose_high is not null and glucose_low between 10 and 1000
        and glucose_high between 10 and 1000 and glucose_low < glucose_high))
      and medication is null and dose_mg is null and interval_days is null and anchor_date is null
    when 'glp1' then glucose_low is null and glucose_high is null
      and medication is not null and medication in ('Semaglutida','Tirzepatida')
      and dose_mg is not null and dose_mg between 0.01 and 100
      and interval_days is not null and interval_days between 1 and 90
      and anchor_date is not null and anchor_date >= date '0001-01-01'
    else glucose_low is null and glucose_high is null and medication is null
      and dose_mg is null and interval_days is null and anchor_date is null end)
);
alter table public.clinical_module_settings add constraint clinical_current_version
  foreign key (patient_id, module_key, current_version_id)
  references public.clinical_module_versions (patient_id, module_key, id) deferrable initially deferred;
create index clinical_versions_doctor on public.clinical_module_versions (doctor_id);

create table public.glucose_readings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null default 'diabetes' check (module_key = 'diabetes'),
  module_version_id uuid not null,
  request_id uuid not null,
  occurred_at timestamptz not null check (occurred_at <= now()),
  time_zone text not null check (char_length(time_zone) between 1 and 80),
  value numeric not null check (value between 10 and 1000),
  context text not null check (context in ('fasting','before_meal','after_meal','bedtime','other')),
  created_at timestamptz not null default now(),
  unique (patient_id, request_id),
  foreign key (patient_id, module_key, module_version_id) references public.clinical_module_versions(patient_id,module_key,id)
);
create table public.hypoglycemia_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null default 'diabetes' check (module_key = 'diabetes'),
  module_version_id uuid not null,
  request_id uuid not null,
  occurred_at timestamptz not null check (occurred_at <= now()),
  time_zone text not null check (char_length(time_zone) between 1 and 80),
  value numeric check (value between 10 and 1000),
  symptoms text not null check (char_length(trim(symptoms)) between 1 and 300),
  action_taken text not null check (char_length(trim(action_taken)) between 1 and 300),
  created_at timestamptz not null default now(),
  unique (patient_id, request_id),
  foreign key (patient_id, module_key, module_version_id) references public.clinical_module_versions(patient_id,module_key,id)
);
create table public.hba1c_results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null default 'diabetes' check (module_key = 'diabetes'),
  module_version_id uuid not null,
  request_id uuid not null,
  occurred_on date not null check (occurred_on >= date '0001-01-01'),
  time_zone text not null check (char_length(time_zone) between 1 and 80),
  value numeric not null check (value between 1 and 30),
  created_at timestamptz not null default now(),
  unique (patient_id, request_id),
  foreign key (patient_id, module_key, module_version_id) references public.clinical_module_versions(patient_id,module_key,id)
);
create table public.injection_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null default 'glp1' check (module_key = 'glp1'),
  module_version_id uuid not null,
  request_id uuid not null,
  occurred_at timestamptz not null check (occurred_at <= now()),
  time_zone text not null check (char_length(time_zone) between 1 and 80),
  site text not null check (site in ('abdomen','thigh','arm')),
  created_at timestamptz not null default now(),
  unique (patient_id, request_id),
  foreign key (patient_id, module_key, module_version_id) references public.clinical_module_versions(patient_id,module_key,id)
);
create table public.gi_symptom_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null default 'glp1' check (module_key = 'glp1'),
  module_version_id uuid not null,
  request_id uuid not null,
  occurred_at timestamptz not null check (occurred_at <= now()),
  time_zone text not null check (char_length(time_zone) between 1 and 80),
  nausea smallint not null check (nausea between 0 and 3),
  vomiting smallint not null check (vomiting between 0 and 3),
  constipation smallint not null check (constipation between 0 and 3),
  diarrhea smallint not null check (diarrhea between 0 and 3),
  reflux smallint not null check (reflux between 0 and 3),
  created_at timestamptz not null default now(),
  unique (patient_id, request_id),
  foreign key (patient_id, module_key, module_version_id) references public.clinical_module_versions(patient_id,module_key,id)
);
create table public.thyroid_intakes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null default 'thyroid' check (module_key = 'thyroid'),
  module_version_id uuid not null,
  request_id uuid not null,
  occurred_at timestamptz not null check (occurred_at <= now()),
  time_zone text not null check (char_length(time_zone) between 1 and 80),
  fasting text not null check (fasting in ('yes','no','unsure')),
  created_at timestamptz not null default now(),
  unique (patient_id, request_id),
  foreign key (patient_id, module_key, module_version_id) references public.clinical_module_versions(patient_id,module_key,id)
);
create table public.blood_pressure_readings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null default 'pressure' check (module_key = 'pressure'),
  module_version_id uuid not null,
  request_id uuid not null,
  occurred_at timestamptz not null check (occurred_at <= now()),
  time_zone text not null check (char_length(time_zone) between 1 and 80),
  systolic numeric not null check (systolic between 40 and 300),
  diastolic numeric not null check (diastolic between 20 and 200),
  pulse numeric check (pulse between 20 and 250),
  created_at timestamptz not null default now(),
  check (systolic > diastolic),
  unique (patient_id, request_id),
  foreign key (patient_id, module_key, module_version_id) references public.clinical_module_versions(patient_id,module_key,id)
);

-- All writes go through narrow RPCs; authenticated users have SELECT only.
do $$ declare t text; begin
  foreach t in array array['patient_module_permissions','clinical_module_settings','clinical_module_versions',
    'glucose_readings','hypoglycemia_events','hba1c_results','injection_logs','gi_symptom_logs','thyroid_intakes','blood_pressure_readings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy clinical_patient_read on public.%I for select to authenticated using (patient_id = (select auth.uid()))', t);
    if t = 'patient_module_permissions' then
      execute format('create policy clinical_doctor_read on public.%I for select to authenticated using (doctor_id = (select auth.uid()) and endo_private.can_read_patient(patient_id))', t);
    else
      execute format('create policy clinical_shared_read on public.%I for select to authenticated using (endo_private.can_read_patient(patient_id))', t);
    end if;
    if t not in ('patient_module_permissions','clinical_module_settings','clinical_module_versions') then
      execute format('create index %I on public.%I (patient_id, %I desc, id desc)', t || '_patient_history', t, case when t = 'hba1c_results' then 'occurred_on' else 'occurred_at' end);
      execute format('create index %I on public.%I (module_version_id)', t || '_version', t);
    end if;
  end loop;
end $$;

create function endo_private.clinical_keys(p_values jsonb, p_allowed text[])
returns void language plpgsql set search_path = '' as $$ begin
  if p_values is null or jsonb_typeof(p_values) <> 'object' or exists (
    select 1 from jsonb_object_keys(p_values) k where not (k = any(p_allowed))
  ) then raise exception 'Invalid clinical fields' using errcode = '22023'; end if;
end $$;

create function endo_private.clinical_active(p_setting uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.clinical_module_settings s
    join public.patient_module_permissions p on p.id = s.permission_id
    join public.patient_shares a on a.patient_id = s.patient_id and a.doctor_id = s.doctor_id
    join public.doctor_profiles d on d.user_id = s.doctor_id
    where s.id = p_setting and s.enabled and s.current_version_id is not null
      and p.patient_id = s.patient_id and p.doctor_id = s.doctor_id and p.revoked_at is null
      and p.share_granted_at = a.granted_at and a.revoked_at is null
      and (a.expires_at is null or a.expires_at > now())
      and d.profession = 'Medicina' and d.council = 'CRM'
      and (s.patient_id = (select auth.uid()) or endo_private.can_read_patient(s.patient_id)));
$$;

create function endo_private.clinical_overview(p_patient uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$ begin
  if auth.uid() is null or not (auth.uid() = p_patient or endo_private.can_read_patient(p_patient)) then
    raise insufficient_privilege using message = 'Patient authorization required';
  end if;
  return jsonb_build_object(
    'modules', coalesce((select jsonb_agg(to_jsonb(s) || jsonb_build_object('active', endo_private.clinical_active(s.id), 'version', to_jsonb(v)) order by s.module_key)
      from public.clinical_module_settings s left join public.clinical_module_versions v on v.id = s.current_version_id where s.patient_id = p_patient), '[]'::jsonb),
    'permissions', coalesce((select jsonb_agg(to_jsonb(p) order by p.granted_at desc) from public.patient_module_permissions p
      where p.patient_id = p_patient and (p_patient = auth.uid() or p.doctor_id = auth.uid())), '[]'::jsonb));
end $$;

create function endo_private.clinical_grant(p_doctor uuid, p_request uuid, p_confirmed boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.patient_shares; existing public.patient_module_permissions; created uuid;
begin
  if auth.uid() is null or p_confirmed is distinct from true then raise insufficient_privilege using message = 'Explicit patient consent required'; end if;
  if p_request is null then raise exception 'Request identity required' using errcode = '22023'; end if;
  select * into a from public.patient_shares where patient_id = auth.uid() and doctor_id = p_doctor for update;
  if not found or a.revoked_at is not null or (a.expires_at is not null and a.expires_at <= now())
    or not exists(select 1 from public.doctor_profiles where user_id = p_doctor and profession = 'Medicina' and council = 'CRM') then
    raise insufficient_privilege using message = 'An active patient grant to a physician is required';
  end if;
  select * into existing from public.patient_module_permissions where patient_id = auth.uid() and request_id = p_request;
  if found then
    if existing.doctor_id is distinct from p_doctor or existing.share_granted_at is distinct from a.granted_at or existing.revoked_at is not null then
      raise exception 'Consent request is no longer current' using errcode = '40001';
    end if;
    return existing.id;
  end if;
  update public.patient_module_permissions set revoked_at = now() where patient_id = auth.uid() and doctor_id = p_doctor and revoked_at is null;
  insert into public.patient_module_permissions (patient_id, doctor_id, share_granted_at, request_id)
    values (auth.uid(), p_doctor, a.granted_at, p_request) returning id into created;
  return created;
end $$;

create function endo_private.clinical_revoke(p_doctor uuid)
returns void language plpgsql security definer set search_path = '' as $$ begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  perform 1 from public.patient_shares where patient_id = auth.uid() and doctor_id = p_doctor for update;
  update public.patient_module_permissions set revoked_at = now() where patient_id = auth.uid() and doctor_id = p_doctor and revoked_at is null;
end $$;

create function endo_private.clinical_configure(p_patient uuid, p_module text, p_expected uuid, p_request uuid, p_config jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.patient_shares; p public.patient_module_permissions; s public.clinical_module_settings;
  v public.clinical_module_versions; retry public.clinical_module_versions; revision integer; low numeric; high numeric; drug text; dose numeric; days integer; anchor date;
begin
  if auth.uid() is null or p_request is null or p_module not in ('diabetes','glp1','thyroid','pressure') then raise insufficient_privilege; end if;
  select * into a from public.patient_shares where patient_id = p_patient and doctor_id = auth.uid() for update;
  if not found or a.revoked_at is not null or (a.expires_at is not null and a.expires_at <= now())
    or not exists(select 1 from public.doctor_profiles where user_id = auth.uid() and profession = 'Medicina' and council = 'CRM') then raise insufficient_privilege using message = 'Physician authorization required'; end if;
  select * into p from public.patient_module_permissions where patient_id = p_patient and doctor_id = auth.uid()
    and revoked_at is null and share_granted_at = a.granted_at for share;
  if not found then raise insufficient_privilege using message = 'Separate activation consent required'; end if;
  if p_module = 'diabetes' then
    perform endo_private.clinical_keys(p_config, array['low','high']);
    low := (p_config->>'low')::numeric; high := (p_config->>'high')::numeric;
  elsif p_module = 'glp1' then
    perform endo_private.clinical_keys(p_config, array['medication','dose_mg','interval_days','anchor_date']);
    if coalesce(p_config->>'interval_days','') !~ '^[1-9][0-9]*$' then raise exception 'Invalid interval' using errcode = '22023'; end if;
    drug := p_config->>'medication'; dose := (p_config->>'dose_mg')::numeric;
    days := (p_config->>'interval_days')::integer; anchor := (p_config->>'anchor_date')::date;
  else perform endo_private.clinical_keys(p_config, array[]::text[]); end if;
  insert into public.clinical_module_settings (patient_id,module_key,doctor_id,permission_id)
    values (p_patient,p_module,auth.uid(),p.id) on conflict (patient_id,module_key) do nothing;
  select * into s from public.clinical_module_settings where patient_id = p_patient and module_key = p_module for update;
  if s.enabled and s.doctor_id is distinct from auth.uid() then raise insufficient_privilege using message = 'Patient must close the previous responsible module'; end if;
  select * into retry from public.clinical_module_versions where setting_id = s.id and request_id = p_request;
  if found then
    if s.permission_id is distinct from p.id or s.current_version_id is distinct from retry.id
      or retry.doctor_id is distinct from auth.uid() or not s.enabled
      or row(retry.glucose_low,retry.glucose_high,retry.medication,retry.dose_mg,retry.interval_days,retry.anchor_date)
         is distinct from row(low,high,drug,dose,days,anchor) then raise exception 'Stale or reused configuration request' using errcode = '40001'; end if;
    return to_jsonb(retry);
  end if;
  if s.current_version_id is distinct from p_expected then raise exception 'Configuration changed; reload first' using errcode = '40001'; end if;
  select coalesce(max(x.revision),0) + 1 into revision from public.clinical_module_versions x where x.setting_id = s.id;
  insert into public.clinical_module_versions (setting_id,patient_id,module_key,doctor_id,revision,request_id,glucose_low,glucose_high,medication,dose_mg,interval_days,anchor_date)
    values (s.id,p_patient,p_module,auth.uid(),revision,p_request,low,high,drug,dose,days,anchor) returning * into v;
  update public.clinical_module_settings set doctor_id = auth.uid(), permission_id = p.id, enabled = true, current_version_id = v.id where id = s.id;
  return to_jsonb(v);
end $$;

create function endo_private.clinical_close(p_module text, p_expected uuid)
returns void language plpgsql security definer set search_path = '' as $$ declare s public.clinical_module_settings;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  select * into s from public.clinical_module_settings where patient_id = auth.uid() and module_key = p_module for update;
  if not found then raise exception 'Module not found' using errcode = '22023'; end if;
  if s.current_version_id is distinct from p_expected then raise exception 'Configuration changed; reload first' using errcode = '40001'; end if;
  update public.clinical_module_settings set enabled = false where id = s.id;
end $$;

-- Lock order matches grant/configuration: sharing, activation consent, module.
create function endo_private.clinical_lock_module(p_module text)
returns public.clinical_module_settings language plpgsql security definer set search_path = '' as $$
declare s public.clinical_module_settings; current_s public.clinical_module_settings;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  select * into s from public.clinical_module_settings where patient_id = auth.uid() and module_key = p_module;
  if not found then raise insufficient_privilege using message = 'Module inactive'; end if;
  perform 1 from public.patient_shares where patient_id = s.patient_id and doctor_id = s.doctor_id for share;
  perform 1 from public.patient_module_permissions where id = s.permission_id for share;
  select * into current_s from public.clinical_module_settings where id = s.id for share;
  if row(current_s.doctor_id,current_s.permission_id,current_s.current_version_id) is distinct from row(s.doctor_id,s.permission_id,s.current_version_id)
    then raise exception 'Module changed; reload first' using errcode = '40001'; end if;
  if not endo_private.clinical_active(s.id) then raise insufficient_privilege using message = 'Module inactive'; end if;
  return current_s;
end $$;

create function endo_private.clinical_save(p_kind text, p_version uuid, p_request uuid, p_values jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m text; t text; allowed text[]; s public.clinical_module_settings; v public.clinical_module_versions;
  occurred timestamptz; day date; zone text; result jsonb; previous jsonb; key text;
begin
  if auth.uid() is null or p_request is null then raise insufficient_privilege; end if;
  case p_kind
    when 'glucose' then m := 'diabetes'; t := 'glucose_readings'; allowed := array['value','context'];
    when 'hypoglycemia' then m := 'diabetes'; t := 'hypoglycemia_events'; allowed := array['value','symptoms','action_taken'];
    when 'hba1c' then m := 'diabetes'; t := 'hba1c_results'; allowed := array['value'];
    when 'injection' then m := 'glp1'; t := 'injection_logs'; allowed := array['site'];
    when 'gi' then m := 'glp1'; t := 'gi_symptom_logs'; allowed := array['nausea','vomiting','constipation','diarrhea','reflux'];
    when 'thyroid' then m := 'thyroid'; t := 'thyroid_intakes'; allowed := array['fasting'];
    when 'pressure' then m := 'pressure'; t := 'blood_pressure_readings'; allowed := array['systolic','diastolic','pulse'];
    else raise exception 'Unknown record kind' using errcode = '22023';
  end case;
  allowed := allowed || array['time_zone', case when p_kind = 'hba1c' then 'occurred_on' else 'occurred_at' end];
  perform endo_private.clinical_keys(p_values, allowed);
  foreach key in array allowed loop
    if key in ('value','systolic','diastolic','pulse','nausea','vomiting','constipation','diarrhea','reflux') then
      if jsonb_typeof(p_values->key) is distinct from 'number' and not (
        (key = 'pulse' or (key = 'value' and p_kind = 'hypoglycemia'))
        and (not p_values ? key or p_values->key = 'null'::jsonb)
      ) then raise exception 'Clinical numeric field must be a number' using errcode = '22023'; end if;
    elsif jsonb_typeof(p_values->key) is distinct from 'string' then
      raise exception 'Clinical text field must be a string' using errcode = '22023';
    end if;
  end loop;
  zone := p_values->>'time_zone';
  if zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name = zone) then raise exception 'Invalid time zone' using errcode = '22023'; end if;
  if p_kind = 'hba1c' then
    if coalesce(p_values->>'occurred_on','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid exam date' using errcode = '22023'; end if;
    day := (p_values->>'occurred_on')::date;
    if day > (now() at time zone zone)::date then raise exception 'Future exam date' using errcode = '22023'; end if;
  else
    if coalesce(p_values->>'occurred_at','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
      then raise exception 'Timestamp must include an offset' using errcode = '22023'; end if;
    occurred := (p_values->>'occurred_at')::timestamptz;
  end if;
  if p_kind = 'gi' then foreach key in array array['nausea','vomiting','constipation','diarrhea','reflux'] loop
    if coalesce(p_values->>key,'') !~ '^[0-3]$' then raise exception 'Invalid symptom intensity' using errcode = '22023'; end if;
  end loop; end if;
  s := endo_private.clinical_lock_module(m);
  if s.current_version_id is distinct from p_version then raise exception 'Clinical plan changed; reload first' using errcode = '40001'; end if;
  select * into v from public.clinical_module_versions where id = p_version;
  if p_kind = 'injection' and (occurred at time zone zone)::date < v.anchor_date then raise exception 'Application predates this plan' using errcode = '22023'; end if;
  execute format('select to_jsonb(r) from public.%I r where patient_id = $1 and request_id = $2', t) into previous using auth.uid(), p_request;
  if previous is not null then
    if (previous->>'module_version_id')::uuid is distinct from p_version then raise exception 'Reused request identity' using errcode = '40001'; end if;
    foreach key in array allowed loop
      if key = 'occurred_at' then
        if (previous->>key)::timestamptz is distinct from occurred then raise exception 'Reused request identity' using errcode = '40001'; end if;
      elsif (previous->key) is distinct from (p_values->key) and not ((previous->key) = 'null'::jsonb and not p_values ? key) then
        raise exception 'Reused request identity' using errcode = '40001';
      end if;
    end loop;
    return previous;
  end if;
  -- Table names come only from the fixed CASE above, never from the caller.
  execute format('insert into public.%I select (jsonb_populate_record(null::public.%I, $1)).* on conflict (patient_id,request_id) do nothing returning to_jsonb(%I.*)', t,t,t)
    into result using p_values || jsonb_build_object('id',gen_random_uuid(),'patient_id',auth.uid(),'module_key',m,'module_version_id',p_version,'request_id',p_request,'created_at',now());
  if result is null then return endo_private.clinical_save(p_kind,p_version,p_request,p_values); end if;
  return result;
end $$;
create function public.endo_clinical_overview(p_patient_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select endo_private.clinical_overview(p_patient_id); $$;
create function endo_private.clinical_actor(p_expected uuid) returns void
language plpgsql security invoker set search_path = '' as $$ begin
  if auth.uid() is null or auth.uid() is distinct from p_expected then raise insufficient_privilege using message = 'Authenticated account changed'; end if;
end $$;
create function public.endo_grant_clinical_activation(p_actor_id uuid,p_doctor_id uuid,p_request_id uuid,p_confirmed boolean) returns uuid
language plpgsql security invoker set search_path = '' as $$ begin perform endo_private.clinical_actor(p_actor_id); return endo_private.clinical_grant(p_doctor_id,p_request_id,p_confirmed); end $$;
create function public.endo_revoke_clinical_activation(p_actor_id uuid,p_doctor_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$ begin perform endo_private.clinical_actor(p_actor_id); perform endo_private.clinical_revoke(p_doctor_id); end $$;
create function public.endo_configure_clinical_module(p_actor_id uuid,p_patient_id uuid,p_module_key text,p_expected_version uuid,p_request_id uuid,p_config jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$ begin perform endo_private.clinical_actor(p_actor_id); return endo_private.clinical_configure(p_patient_id,p_module_key,p_expected_version,p_request_id,p_config); end $$;
create function public.endo_close_clinical_module(p_actor_id uuid,p_module_key text,p_expected_version uuid) returns void
language plpgsql security invoker set search_path = '' as $$ begin perform endo_private.clinical_actor(p_actor_id); perform endo_private.clinical_close(p_module_key,p_expected_version); end $$;
create function public.endo_save_clinical_record(p_actor_id uuid,p_kind text,p_module_version uuid,p_request_id uuid,p_values jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$ begin perform endo_private.clinical_actor(p_actor_id); return endo_private.clinical_save(p_kind,p_module_version,p_request_id,p_values); end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'endo_private' and p.proname like 'clinical\_%' escape '\')
      or (n.nspname = 'public' and p.proname in ('endo_clinical_overview','endo_grant_clinical_activation','endo_revoke_clinical_activation','endo_configure_clinical_module','endo_close_clinical_module','endo_save_clinical_record')) loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
    execute format('grant execute on function %s to authenticated', f.signature);
  end loop;
end $$;
revoke all on function endo_private.clinical_invalidate_activation() from public, anon, authenticated;
