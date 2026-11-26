do $$
begin
  if coalesce(public.endo_homologation_info()->>'project_id', '')
       <> 'ctcsolobseerqnddahun'
     or coalesce(public.endo_homologation_info()->>'environment', '')
       <> 'homologation'
     or coalesce((public.endo_homologation_info()->>'synthetic_only')::boolean, false)
       is not true then
    raise exception 'Reminder permissions are restricted to synthetic homologation.';
  end if;
end;
$$;

revoke all on function public.endo_disable_push_when_schedule_disabled()
  from public, anon, authenticated;
