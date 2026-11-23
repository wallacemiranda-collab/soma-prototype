import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isValidVapidPublicKey } from '../src/lib/webPush.js'

const phase3Branch = 'codex/fase3-previa'
const reminderHomologationBranch = 'codex/lembretes-homologacao'
const calculatorPreviewBranch = 'codex/fase8-privacidade'
const reminderHomologationProject = 'ctcsolobseerqnddahun'
const calculatorPreviewProject = 'ctcsolobseerqnddahun'
const phase3Environment = {
  VITE_PHASE3_PREVIEW_ENABLED: 'true',
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
  VITE_HOMOLOGATION_ENABLED: 'false',
  VITE_CLINICAL_PREVIEW_ENABLED: 'false',
  VITE_CLINICAL_INTEGRATION_ENABLED: 'false',
  VITE_GOOGLE_AUTH_ENABLED: 'false',
  VITE_REMINDERS_HOMOLOGATION_ENABLED: 'false',
}
const reminderHomologationEnvironment = {
  VITE_PHASE3_PREVIEW_ENABLED: 'false',
  VITE_HOMOLOGATION_ENABLED: 'true',
  VITE_REMINDERS_HOMOLOGATION_ENABLED: 'true',
  VITE_CLINICAL_INTEGRATION_ENABLED: 'true',
  VITE_CLINICAL_PREVIEW_ENABLED: 'false',
  VITE_GOOGLE_AUTH_ENABLED: 'false',
}
const calculatorPreviewEnvironment = {
  VITE_CALCULATORS_ENABLED: 'true',
  VITE_HOMOLOGATION_ENABLED: 'true',
  VITE_CLINICAL_INTEGRATION_ENABLED: 'true',
  VITE_CLINICAL_PREVIEW_ENABLED: 'false',
  VITE_PHASE3_PREVIEW_ENABLED: 'false',
  VITE_REMINDERS_HOMOLOGATION_ENABLED: 'false',
  VITE_GOOGLE_AUTH_ENABLED: 'false',
}

export function getBuildEnvironment(environment = process.env) {
  const env = { ...environment }
  const isVercelPreview = env.VERCEL === '1' && env.VERCEL_ENV === 'preview'
  const isVercelProduction =
    env.VERCEL === '1' && env.VERCEL_ENV === 'production'

  if (isVercelPreview && !env.VERCEL_GIT_COMMIT_REF)
    throw new Error('Preview builds require Vercel Git branch metadata.')

  const isPhase3Preview =
    isVercelPreview && env.VERCEL_GIT_COMMIT_REF === phase3Branch
  const isReminderHomologationPreview =
    isVercelPreview &&
    env.VERCEL_GIT_COMMIT_REF === reminderHomologationBranch
  const isCalculatorPreview =
    isVercelPreview && env.VERCEL_GIT_COMMIT_REF === calculatorPreviewBranch

  if (isPhase3Preview) Object.assign(env, phase3Environment)
  else if (isReminderHomologationPreview) {
    const forbiddenClientKeys = Object.keys(env).filter(
      (key) =>
        key.startsWith('VITE_') &&
        /(SERVICE_ROLE|SECRET|PRIVATE|PASSWORD)/i.test(key) &&
        env[key],
    )
    if (
      env.VITE_SUPABASE_URL !==
        `https://${reminderHomologationProject}.supabase.co` ||
      !env.VITE_SUPABASE_ANON_KEY?.startsWith('sb_publishable_') ||
      !isValidVapidPublicKey(env.VITE_REMINDER_VAPID_PUBLIC_KEY) ||
      forbiddenClientKeys.length
    )
      throw new Error(
        'Reminder homologation builds require the staging URL, publishable staging key, and a valid public push key.',
      )
    Object.assign(env, reminderHomologationEnvironment)
  } else if (isCalculatorPreview) {
    const forbiddenClientKeys = Object.keys(env).filter(
      (key) =>
        key.startsWith('VITE_') &&
        /(SERVICE_ROLE|SECRET|PRIVATE|PASSWORD)/i.test(key) &&
        env[key],
    )
    if (
      env.VITE_SUPABASE_URL !== `https://${calculatorPreviewProject}.supabase.co` ||
      !env.VITE_SUPABASE_ANON_KEY?.startsWith('sb_publishable_') ||
      forbiddenClientKeys.length
    )
      throw new Error(
        'Calculator preview builds require only the homologation URL and a public staging key.',
      )
    Object.assign(env, calculatorPreviewEnvironment)
  } else if (isVercelPreview || isVercelProduction) {
    env.VITE_PHASE3_PREVIEW_ENABLED = 'false'
    env.VITE_REMINDERS_HOMOLOGATION_ENABLED = 'false'
    env.VITE_CALCULATORS_ENABLED = 'false'
  }

  return {
    env,
    isPhase3Preview,
    isReminderHomologationPreview,
    isCalculatorPreview,
  }
}

export function build() {
  const { env, isPhase3Preview } = getBuildEnvironment()
  const result = spawnSync(
    process.execPath,
    [resolve('node_modules/vite/bin/vite.js'), 'build'],
    { env, stdio: 'inherit' },
  )

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)

  if (isPhase3Preview) {
    mkdirSync(resolve('dist'), { recursive: true })
    writeFileSync(resolve('dist/robots.txt'), 'User-agent: *\nDisallow: /\n')
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  build()
