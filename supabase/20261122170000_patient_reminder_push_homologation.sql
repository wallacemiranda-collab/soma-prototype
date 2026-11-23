-- Apply only to the empty synthetic homologation project.
do $$
begin
  if coalesce(public.endo_homologation_info()->>'project_id', '')
       <> 'ctcsolobseerqnddahun'
     or coalesce(public.endo_homologation_info()->>'environment', '')
       <> 'homologation'
     or coalesce((public.endo_homologation_info()->>'synthetic_only')::boolean, false)
       is not true then
    raise exception 'Patient push reminders are restricted to synthetic homologation.';
  end if;
end;
$$;

create table public.patient_reminder_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null
    references public.patient_reminder_preferences(patient_id) on delete cascade,
  endpoint text not null unique
    check (char_length(endpoint) between 1 and 2048),
  p256dh text not null check (char_length(p256dh) between 32 and 256),
  auth_secret text not null check (char_length(auth_secret) between 16 and 128),
  consent_version text not null
    check (consent_version = 'endo-reminder-push-homologation-v1'),
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patient_reminder_push_subscriptions_patient_idx
  on public.patient_reminder_push_subscriptions(patient_id);

create table public.patient_reminder_delivery_queue (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null
    references public.patient_reminder_push_subscriptions(id) on delete cascade,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  reminder_kind text not null
    check (reminder_kind in ('medication', 'application', 'weight', 'daily')),
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'expired')),
  attempts smallint not null default 0 check (attempts between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  response_status smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, reminder_kind, scheduled_at)
);

create index patient_reminder_delivery_queue_claim_idx
  on public.patient_reminder_delivery_queue(status, next_attempt_at, created_at)
  where status in ('pending', 'failed', 'processing');

alter table public.patient_reminder_push_subscriptions enable row level security;
alter table public.patient_reminder_delivery_queue enable row level security;

create policy "Synthetic patients read their own push subscriptions"
  on public.patient_reminder_push_subscriptions for select to authenticated
  using (
    auth.uid() = patient_id
    and coalesce(auth.jwt()->>'email', '')
      ~* '^endo-[0-9a-f]{16}-(patient|otherpatient)@example\.invalid$'
  );

revoke all on public.patient_reminder_push_subscriptions,
  public.patient_reminder_delivery_queue from public, anon, authenticated;
grant select (id, patient_id, endpoint) on public.patient_reminder_push_subscriptions
  to authenticated;

create or replace function public.endo_upsert_patient_reminder_push_subscription(
  p_subscription jsonb,
  p_consent_accepted boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid := auth.uid();
  v_email text := coalesce(auth.jwt()->>'email', '');
  v_endpoint text := p_subscription->>'endpoint';
  v_p256dh text := p_subscription->'keys'->>'p256dh';
  v_auth text := p_subscription->'keys'->>'auth';
  v_id uuid;
begin
  if v_patient_id is null
     or v_email !~* '^endo-[0-9a-f]{16}-(patient|otherpatient)@example\.invalid$' then
    raise exception 'Synthetic patient account required.' using errcode = '42501';
  end if;
  if p_consent_accepted is distinct from true then
    raise exception 'Push notification consent is required.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_subscription) is distinct from 'object'
     or coalesce(v_endpoint, '') !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|([a-z0-9-]+\.)?notify\.windows\.com)(/|$)'
     or char_length(v_endpoint) > 2048
     or coalesce(v_p256dh, '') !~ '^[A-Za-z0-9_-]{32,255}$'
     or coalesce(v_auth, '') !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception 'Invalid push subscription.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.patient_reminder_preferences p
    where p.patient_id = v_patient_id
      and p.enabled
      and p.consent_version = 'endo-reminders-homologation-v1'
      and p.consented_at is not null
      and p.consent_revoked_at is null
  ) then
    raise exception 'Enable a reminder schedule before push enrollment.' using errcode = '42501';
  end if;

  insert into public.patient_reminder_push_subscriptions (
    patient_id, endpoint, p256dh, auth_secret, consent_version,
    consented_at, updated_at
  ) values (
    v_patient_id, v_endpoint, v_p256dh, v_auth,
    'endo-reminder-push-homologation-v1', now(), now()
  )
  on conflict (endpoint) do update set
    patient_id = excluded.patient_id,
    p256dh = excluded.p256dh,
    auth_secret = excluded.auth_secret,
    consent_version = excluded.consent_version,
    consented_at = now(),
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.endo_remove_patient_reminder_push_subscription(
  p_endpoint text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid := auth.uid();
  v_email text := coalesce(auth.jwt()->>'email', '');
begin
  if v_patient_id is null
     or v_email !~* '^endo-[0-9a-f]{16}-(patient|otherpatient)@example\.invalid$' then
    raise exception 'Synthetic patient account required.' using errcode = '42501';
  end if;
  delete from public.patient_reminder_push_subscriptions
  where patient_id = v_patient_id
    and (p_endpoint is null or endpoint = p_endpoint);
end;
$$;

create or replace function public.endo_disable_push_when_schedule_disabled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.enabled or new.consent_revoked_at is not null then
    delete from public.patient_reminder_push_subscriptions
    where patient_id = new.patient_id;
  end if;
  return new;
end;
$$;

create trigger patient_reminder_disable_push_after_schedule_change
  after insert or update of enabled, consent_revoked_at
  on public.patient_reminder_preferences
  for each row execute function public.endo_disable_push_when_schedule_disabled();

create or replace function public.endo_revoke_patient_reminder_schedule()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid := auth.uid();
  v_email text := coalesce(auth.jwt()->>'email', '');
begin
  if v_patient_id is null
     or v_email !~* '^endo-[0-9a-f]{16}-(patient|otherpatient)@example\.invalid$' then
    raise exception 'Synthetic patient account required.' using errcode = '42501';
  end if;
  update public.patient_reminder_preferences
  set enabled = false,
      time_zone = 'America/Sao_Paulo',
      quiet_hours_enabled = true,
      quiet_start = time '22:00',
      quiet_end = time '08:00',
      consent_revoked_at = now(),
      updated_at = now()
  where patient_id = v_patient_id;
  delete from public.patient_reminder_rules where patient_id = v_patient_id;
  delete from public.patient_reminder_push_subscriptions where patient_id = v_patient_id;
end;
$$;

create or replace function public.endo_reminder_vapid_credentials()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credentials jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'publicKey', max(decrypted_secret) filter (where name = 'endo_reminder_vapid_public_key'),
    'privateKey', max(decrypted_secret) filter (where name = 'endo_reminder_vapid_private_key')
  ) into v_credentials
  from vault.decrypted_secrets
  where name in ('endo_reminder_vapid_public_key', 'endo_reminder_vapid_private_key');
  if v_credentials->>'publicKey' is null or v_credentials->>'privateKey' is null then
    raise exception 'Push credentials are not configured.' using errcode = '55000';
  end if;
  return v_credentials;
end;
$$;

create or replace function public.endo_reminder_dispatch_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'endo_reminder_dispatch_token';
  if v_secret is null then
    raise exception 'Dispatch token is not configured.' using errcode = '55000';
  end if;
  return v_secret;
end;
$$;

create or replace function public.endo_claim_due_patient_reminder_deliveries(
  p_now timestamptz default now(),
  p_limit integer default 50
)
returns table (
  delivery_id uuid,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth_secret text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid delivery batch size.' using errcode = '22023';
  end if;

  update public.patient_reminder_delivery_queue q
  set status = 'failed', next_attempt_at = p_now, updated_at = p_now
  where q.status = 'processing' and q.updated_at < p_now - interval '5 minutes'
    and q.attempts < 3;

  insert into public.patient_reminder_delivery_queue (
    subscription_id, patient_id, reminder_kind, scheduled_at, status,
    attempts, next_attempt_at
  )
  select s.id, p.patient_id, r.kind,
    ((p_now at time zone p.time_zone)::date + r.reminder_time) at time zone p.time_zone,
    'pending', 0, p_now
  from public.patient_reminder_preferences p
  join public.patient_reminder_rules r on r.patient_id = p.patient_id
  join public.patient_reminder_push_subscriptions s on s.patient_id = p.patient_id
  join auth.users u on u.id = p.patient_id
  where p.enabled
    and p.consent_version = 'endo-reminders-homologation-v1'
    and p.consented_at is not null
    and p.consent_revoked_at is null
    and coalesce(u.email, '') ~* '^endo-[0-9a-f]{16}-(patient|otherpatient)@example\.invalid$'
    and r.enabled
    and (
      r.weekday is null
      or extract(dow from (p_now at time zone p.time_zone))::integer = r.weekday
    )
    and ((p_now at time zone p.time_zone)::date + r.reminder_time)
      at time zone p.time_zone between p_now - interval '5 minutes' and p_now
    and (
      not p.quiet_hours_enabled
      or case
        when p.quiet_start < p.quiet_end then
          (p_now at time zone p.time_zone)::time < p.quiet_start
          or (p_now at time zone p.time_zone)::time >= p.quiet_end
        else
          (p_now at time zone p.time_zone)::time < p.quiet_start
          and (p_now at time zone p.time_zone)::time >= p.quiet_end
      end
    )
  on conflict do nothing;

  return query
  with claimed as (
    select q.id
    from public.patient_reminder_delivery_queue q
    where q.status in ('pending', 'failed')
      and q.attempts < 3
      and q.next_attempt_at <= p_now
    order by q.created_at
    for update skip locked
    limit p_limit
  ), updated as (
    update public.patient_reminder_delivery_queue q
    set status = 'processing', attempts = q.attempts + 1, updated_at = p_now
    from claimed c
    where q.id = c.id
    returning q.id, q.subscription_id
  )
  select u.id, s.id, s.endpoint, s.p256dh, s.auth_secret
  from updated u
  join public.patient_reminder_push_subscriptions s on s.id = u.subscription_id;
end;
$$;

create or replace function public.endo_finish_patient_reminder_delivery(
  p_delivery_id uuid,
  p_result text,
  p_response_status smallint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;
  if p_result not in ('sent', 'failed', 'expired') then
    raise exception 'Invalid delivery result.' using errcode = '22023';
  end if;
  update public.patient_reminder_delivery_queue q
  set status = p_result,
      response_status = p_response_status,
      next_attempt_at = case
        when p_result = 'failed' then now() + make_interval(mins => power(2, q.attempts)::integer)
        else q.next_attempt_at
      end,
      updated_at = now()
  where q.id = p_delivery_id and q.status = 'processing';
  if p_result = 'expired' then
    delete from public.patient_reminder_push_subscriptions s
    using public.patient_reminder_delivery_queue q
    where q.id = p_delivery_id and s.id = q.subscription_id;
  end if;
end;
$$;

revoke all on function public.endo_upsert_patient_reminder_push_subscription(jsonb, boolean)
  from public, anon;
revoke all on function public.endo_remove_patient_reminder_push_subscription(text)
  from public, anon;
revoke all on function public.endo_disable_push_when_schedule_disabled()
  from public, anon, authenticated;
revoke all on function public.endo_reminder_vapid_credentials()
  from public, anon, authenticated;
revoke all on function public.endo_reminder_dispatch_token()
  from public, anon, authenticated;
revoke all on function public.endo_claim_due_patient_reminder_deliveries(timestamptz, integer)
  from public, anon, authenticated;
revoke all on function public.endo_finish_patient_reminder_delivery(uuid, text, smallint)
  from public, anon, authenticated;
grant execute on function public.endo_upsert_patient_reminder_push_subscription(jsonb, boolean)
  to authenticated;
grant execute on function public.endo_remove_patient_reminder_push_subscription(text)
  to authenticated;
grant execute on function public.endo_reminder_vapid_credentials()
  to service_role;
grant execute on function public.endo_reminder_dispatch_token()
  to service_role;
grant execute on function public.endo_claim_due_patient_reminder_deliveries(timestamptz, integer)
  to service_role;
grant execute on function public.endo_finish_patient_reminder_delivery(uuid, text, smallint)
  to service_role;
