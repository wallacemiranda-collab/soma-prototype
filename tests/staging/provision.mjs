import { randomBytes, randomUUID } from 'node:crypto'
import { writeFileSync, chmodSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadStagingConfig, stagingProject } from './support.mjs'

const action = process.argv[2]
const path =
  process.env.ENDO_STAGING_CONFIG || resolve('.endo-homologation.local')
if (action === 'credentials') {
  const key = process.env.ENDO_STAGING_PUBLISHABLE_KEY
  if (!key?.startsWith('sb_publishable_'))
    throw new Error('A publishable key for the staging project is required.')
  const run = randomBytes(8).toString('hex')
  const config = {
    mode: 'homologation',
    project_id: stagingProject,
    url: `https://${stagingProject}.supabase.co`,
    publishable_key: key,
    run,
    accounts: [
      'patient',
      'otherPatient',
      'doctor',
      'otherDoctor',
      'nutritionist',
    ].map((role) => ({
      role,
      id: randomUUID(),
      email: `endo-${run}-${role.toLowerCase()}@example.invalid`,
      password: randomBytes(30).toString('base64url'),
    })),
  }
  writeFileSync(path, JSON.stringify(config), { mode: 0o600, flag: 'wx' })
  chmodSync(path, 0o600)
  console.log(
    JSON.stringify({ credentialsCreated: true, syntheticAccounts: 5, path }),
  )
} else if (action === 'seed-sql') {
  const config = loadStagingConfig(path)
  const rows = config.accounts
    .map(
      (account) =>
        `('${account.id}'::uuid,'${account.email}','${account.password}')`,
    )
    .join(',')
  const query = `begin;
    do $$ begin if public.endo_homologation_info()->>'project_id' is distinct from '${stagingProject}' then raise exception 'Not staging'; end if; end $$;
    insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,reauthentication_token)
    select '00000000-0000-0000-0000-000000000000'::uuid,id,'authenticated','authenticated',email,extensions.crypt(password,extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','Conta fictícia de homologação'),now(),now(),'','','','','',''
    from (values ${rows}) accounts(id,email,password);
    insert into auth.identities (id,provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    select gen_random_uuid(),id::text,id,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),'email',now(),now(),now() from auth.users where id in (${config.accounts.map((a) => `'${a.id}'::uuid`).join(',')});
    commit;
    select count(*) as seeded_synthetic_accounts from auth.users where id in (${config.accounts.map((a) => `'${a.id}'::uuid`).join(',')});`
  // Contains generated test passwords: consumed privately by the orchestration, never logged.
  process.stdout.write(JSON.stringify({ query }))
} else if (action === 'cleanup-sql') {
  const config = loadStagingConfig(path)
  const ids = config.accounts
    .map((account) => `'${account.id}'::uuid`)
    .join(',')
  process.stdout.write(
    JSON.stringify({
      query: `begin; do $$ begin if public.endo_homologation_info()->>'project_id' is distinct from '${stagingProject}' then raise exception 'Not staging'; end if; end $$; delete from auth.sessions where user_id in (select id from auth.users where id in (${ids}) and email like 'endo-${config.run}-%@example.invalid'); delete from endo_private.doctor_code_reservations where doctor_id in (select id from auth.users where id in (${ids}) and email like 'endo-${config.run}-%@example.invalid'); delete from auth.users where id in (${ids}) and email like 'endo-${config.run}-%@example.invalid'; commit; select count(*) as remaining_test_accounts from auth.users where id in (${ids});`,
    }),
  )
} else throw new Error('Choose credentials, seed-sql or cleanup-sql.')
