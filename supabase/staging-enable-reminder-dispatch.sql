-- Run only after the push migration and dispatch function are deployed to staging.
do $$
begin
  if coalesce(public.endo_homologation_info()->>'project_id', '')
       <> 'ctcsolobseerqnddahun'
     or coalesce(public.endo_homologation_info()->>'environment', '')
       <> 'homologation'
     or coalesce((public.endo_homologation_info()->>'synthetic_only')::boolean, false)
       is not true then
    raise exception 'Reminder dispatch is restricted to synthetic homologation.';
  end if;
  if (
    select count(*) from vault.decrypted_secrets
    where name in (
      'endo_reminder_vapid_private_key',
      'endo_reminder_vapid_public_key',
      'endo_reminder_dispatch_token',
      'endo_reminder_publishable_key'
    )
  ) <> 4 then
    raise exception 'Reminder dispatch secrets are incomplete.';
  end if;
end;
$$;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job
    where jobname = 'endo-homologation-reminder-dispatch'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'endo-homologation-reminder-dispatch',
    '* * * * *',
    $job$
      select net.http_post(
        url := 'https://ctcsolobseerqnddahun.supabase.co/functions/v1/endo-reminder-dispatch',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (
            select decrypted_secret from vault.decrypted_secrets
            where name = 'endo_reminder_publishable_key'
          ),
          'x-endo-dispatch-token', (
            select decrypted_secret from vault.decrypted_secrets
            where name = 'endo_reminder_dispatch_token'
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 10000
      );
    $job$
  );
end;
$$;
