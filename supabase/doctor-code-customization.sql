-- Codes identify a professional; patient authorizations remain keyed by UUID.
alter table public.doctor_profiles
  add constraint doctor_profiles_share_code_format
    check (share_code ~ '^[A-Z0-9]{6,24}$');

-- Retired codes cannot be reassigned, even after the original account is removed.
create table endo_private.doctor_code_reservations (
  code text primary key check (code ~ '^[A-Z0-9]{6,24}$'),
  doctor_id uuid references public.doctor_profiles(user_id) on delete set null,
  reserved_at timestamptz not null default now()
);
create index doctor_code_reservations_doctor_idx
  on endo_private.doctor_code_reservations (doctor_id);
alter table endo_private.doctor_code_reservations enable row level security;
revoke all on endo_private.doctor_code_reservations from public, anon, authenticated;

insert into endo_private.doctor_code_reservations (code, doctor_id)
  select share_code, user_id from public.doctor_profiles;

create or replace function endo_private.reserve_doctor_code()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into endo_private.doctor_code_reservations (code, doctor_id)
    values (new.share_code, new.user_id) on conflict (code) do nothing;
  if not exists (
    select 1 from endo_private.doctor_code_reservations r
    where r.code = new.share_code and r.doctor_id = new.user_id
  ) then
    raise unique_violation using message = 'Doctor code is not available';
  end if;
  return new;
end;
$$;
revoke all on function endo_private.reserve_doctor_code() from public, anon, authenticated;

create trigger reserve_doctor_code
  after insert or update of share_code on public.doctor_profiles
  for each row execute function endo_private.reserve_doctor_code();

-- Only the code is editable; CRM, name, account ID and timestamps stay protected.
grant update (share_code) on public.doctor_profiles to authenticated;
create policy "Doctors change only their own code" on public.doctor_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function endo_private.lookup_doctor(p_code text)
returns table (doctor_id uuid, professional_name text, crm text, crm_state text)
language plpgsql stable security definer set search_path = '' as $$
declare normalized text := upper(regexp_replace(coalesce(p_code, ''), '[[:space:]-]', '', 'g'));
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  if normalized !~ '^[A-Z0-9]{6,24}$' then return; end if;
  return query select d.user_id, d.professional_name, d.crm, d.crm_state
    from public.doctor_profiles d where d.share_code = normalized;
end;
$$;
revoke all on function endo_private.lookup_doctor(text) from public, anon, authenticated;
grant execute on function endo_private.lookup_doctor(text) to authenticated;
