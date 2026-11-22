-- Apply ONLY to the empty, synthetic-data homologation project.
-- This public marker grants no data access and is not an authorization claim.
create function public.endo_homologation_info()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('environment','homologation','project_id','ctcsolobseerqnddahun','synthetic_only',true);
$$;
revoke all on function public.endo_homologation_info() from public;
grant execute on function public.endo_homologation_info() to anon, authenticated;
