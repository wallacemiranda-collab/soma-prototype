-- Preserve existing identities, codes and patient grants. Legacy CRM columns and
-- doctor_id names remain for compatibility, but can describe other professions.
alter table public.doctor_profiles
  add column profession text not null default 'Medicina'
    check (profession = trim(profession) and char_length(profession) between 2 and 80),
  add column council text not null default 'CRM'
    check (council ~ '^[A-Z][A-Z0-9-]{1,19}$');

alter table public.doctor_profiles drop constraint doctor_profiles_crm_check;
alter table public.doctor_profiles
  add constraint doctor_profiles_registration_format
    check (crm ~ '^[A-Z0-9][A-Z0-9./ -]{0,29}$'),
  add constraint doctor_profiles_crm_number
    check (council <> 'CRM' or crm ~ '^[0-9]{1,10}$');

-- Registration identity remains immutable after creation; only codes are editable.
grant insert (profession, council) on public.doctor_profiles to authenticated;

create function endo_private.lookup_professional(p_code text)
returns table (doctor_id uuid, professional_name text, profession text, council text, crm text, crm_state text)
language plpgsql stable security definer set search_path = '' as $$
declare normalized text := upper(regexp_replace(coalesce(p_code, ''), '[[:space:]-]', '', 'g'));
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  if normalized !~ '^[A-Z0-9]{6,24}$' then return; end if;
  return query select d.user_id, d.professional_name, d.profession, d.council, d.crm, d.crm_state
    from public.doctor_profiles d where d.share_code = normalized;
end;
$$;

create function endo_private.my_professionals()
returns table (doctor_id uuid, professional_name text, profession text, council text, crm text, crm_state text, granted_at timestamptz, expires_at timestamptz, revoked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.doctor_id, d.professional_name, d.profession, d.council, d.crm, d.crm_state,
    s.granted_at, s.expires_at, s.revoked_at
  from public.patient_shares s join public.doctor_profiles d on d.user_id = s.doctor_id
  where s.patient_id = (select auth.uid()) order by s.granted_at desc, s.doctor_id;
$$;

create function public.endo_lookup_professional(p_code text)
returns table (doctor_id uuid, professional_name text, profession text, council text, crm text, crm_state text)
language sql stable security invoker set search_path = '' as $$ select * from endo_private.lookup_professional(p_code); $$;
create function public.endo_my_professionals()
returns table (doctor_id uuid, professional_name text, profession text, council text, crm text, crm_state text, granted_at timestamptz, expires_at timestamptz, revoked_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from endo_private.my_professionals(); $$;

do $$
declare signature text;
begin
  foreach signature in array array[
    'endo_private.lookup_professional(text)', 'endo_private.my_professionals()',
    'public.endo_lookup_professional(text)', 'public.endo_my_professionals()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to authenticated', signature);
  end loop;
end;
$$;
