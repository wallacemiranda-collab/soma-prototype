-- Repair an existing Phase 2 installation without changing records or grants.
-- Deterministic business conflicts must not use retryable serialization failures.
-- https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
do $$
declare f record;
begin
  for f in
    select p.oid
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'endo_private'
      and p.proname in ('clinical_grant', 'clinical_configure', 'clinical_close', 'clinical_lock_module', 'clinical_save')
      and position('errcode = ''40001''' in pg_catalog.pg_get_functiondef(p.oid)) > 0
  loop
    execute replace(pg_catalog.pg_get_functiondef(f.oid), 'errcode = ''40001''', 'errcode = ''PT409''');
  end loop;
end $$;
