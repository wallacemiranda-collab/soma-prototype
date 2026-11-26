import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isValidVapidPublicKey } from '../src/lib/webPush.js'

const phase3Branch = 'codex/fase3-previa'
const reminderHomologationBranch = 'codex/lembretes-homologacao'
const foodDiaryPreviewBranch = 'codex/fase9-diario-alimentar'
const phase10And11PreviewBranch = 'codex/fase10-11-previa'
const calculatorPreviewBranches = new Set([
  'codex/fase8-privacidade',
  'codex/publicar-calculadoras',
  'codex/prevent-frax-mayo-findrisc',
])
const reminderHomologationProject = 'ctcsolobseerqnddahun'
const calculatorPreviewProject = 'ctcsolobseerqnddahun'
const calculatorProductionProject = 'trlwhngxqfgksiponpzk'

const phase3Environment = {
  VITE_PHASE3_PREVIEW_ENABLED: 'true',
  VITE_FOOD_DIARY_ENABLED: 'false',
  VITE_GLP1_TREATMENT_ENABLED: 'false',
  VITE_DEVICE_IMPORT_ENABLED: 'false',
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
  VITE_HOMOLOGATION_ENABLED: 'false',
  VITE_CLINICAL_PREVIEW_ENABLED: 'false',
  VITE_CLINICAL_INTEGRATION_ENABLED: 'false',
  VITE_GOOGLE_AUTH_ENABLED: 'false',
  VITE_REMINDERS_HOMOLOGATION_ENABLED: 'false',
  VITE_CALCULATORS_ENABLED: 'false',
}
const reminderHomologationEnvironment = {
  VITE_PHASE3_PREVIEW_ENABLED: 'false',
  VITE_HOMOLOGATION_ENABLED: 'true',
  VITE_REMINDERS_HOMOLOGATION_ENABLED: 'true',
  VITE_CLINICAL_INTEGRATION_ENABLED: 'true',
  VITE_CLINICAL_PREVIEW_ENABLED: 'false',
  VITE_GOOGLE_AUTH_ENABLED: 'false',
  VITE_FOOD_DIARY_ENABLED: 'false',
  VITE_GLP1_TREATMENT_ENABLED: 'false',
  VITE_DEVICE_IMPORT_ENABLED: 'false',
}
const calculatorPreviewEnvironment = {
  VITE_CALCULATORS_ENABLED: 'true',
  VITE_FOOD_DIARY_ENABLED: 'false',
  VITE_GLP1_TREATMENT_ENABLED: 'false',
  VITE_DEVICE_IMPORT_ENABLED: 'false',
  VITE_HOMOLOGATION_ENABLED: 'true',
  VITE_CLINICAL_INTEGRATION_ENABLED: 'true',
  VITE_CLINICAL_PREVIEW_ENABLED: 'false',
  VITE_PHASE3_PREVIEW_ENABLED: 'false',
  VITE_REMINDERS_HOMOLOGATION_ENABLED: 'false',
  VITE_GOOGLE_AUTH_ENABLED: 'false',
}
const foodDiaryPreviewEnvironment = {
  VITE_FOOD_DIARY_ENABLED: 'true',
  VITE_GLP1_TREATMENT_ENABLED: 'false',
  VITE_DEVICE_IMPORT_ENABLED: 'false',
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
  VITE_CALCULATORS_ENABLED: 'false',
  VITE_HOMOLOGATION_ENABLED: 'false',
  VITE_CLINICAL_INTEGRATION_ENABLED: 'false',
  VITE_CLINICAL_PREVIEW_ENABLED: 'false',
  VITE_PHASE3_PREVIEW_ENABLED: 'false',
  VITE_REMINDERS_HOMOLOGATION_ENABLED: 'false',
  VITE_GOOGLE_AUTH_ENABLED: 'false',
}
const phase10And11PreviewEnvironment = {
  VITE_FOOD_DIARY_ENABLED: 'true',
  VITE_GLP1_TREATMENT_ENABLED: 'true',
  VITE_DEVICE_IMPORT_ENABLED: 'true',
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
  VITE_CALCULATORS_ENABLED: 'false',
  VITE_HOMOLOGATION_ENABLED: 'false',
  VITE_CLINICAL_INTEGRATION_ENABLED: 'false',
  VITE_CLINICAL_PREVIEW_ENABLED: 'false',
  VITE_PHASE3_PREVIEW_ENABLED: 'false',
  VITE_REMINDERS_HOMOLOGATION_ENABLED: 'false',
  VITE_GOOGLE_AUTH_ENABLED: 'false',
}

function hasPublicSupabaseKey(value) {
  if (value?.startsWith('sb_publishable_')) return true
  const payload = value?.split('.')[1]
  if (!payload) return false
  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf8')
    return JSON.parse(decoded).role === 'anon'
  } catch {
    return false
  }
}

function hasForbiddenClientKey(environment) {
  return Object.keys(environment).some(
    (key) =>
      key.startsWith('VITE_') &&
      /(SERVICE_ROLE|SECRET|PRIVATE|PASSWORD)/i.test(key) &&
      environment[key],
  )
}

export function getBuildEnvironment(environment = process.env) {
  const env = { ...environment }
  const isVercelPreview = env.VERCEL === '1' && env.VERCEL_ENV === 'preview'
  const isVercelProduction =
    env.VERCEL === '1' && env.VERCEL_ENV === 'production'

  if (isVercelPreview && !env.VERCEL_GIT_COMMIT_REF)
    throw new Error('Preview builds require Vercel Git branch metadata.')

  const branch = env.VERCEL_GIT_COMMIT_REF
  const isPhase3Preview = isVercelPreview && branch === phase3Branch
  const isReminderHomologationPreview =
    isVercelPreview && branch === reminderHomologationBranch
  const isCalculatorPreview =
    isVercelPreview && calculatorPreviewBranches.has(branch)
  const isFoodDiaryPreview = isVercelPreview && branch === foodDiaryPreviewBranch
  const isPhase10And11Preview =
    isVercelPreview && branch === phase10And11PreviewBranch
  const isCalculatorProduction = isVercelProduction

  if (isPhase3Preview) Object.assign(env, phase3Environment)
  else if (isReminderHomologationPreview) {
    if (
      env.VITE_SUPABASE_URL !==
        `https://${reminderHomologationProject}.supabase.co` ||
      !env.VITE_SUPABASE_ANON_KEY?.startsWith('sb_publishable_') ||
      !isValidVapidPublicKey(env.VITE_REMINDER_VAPID_PUBLIC_KEY) ||
      hasForbiddenClientKey(env)
    )
      throw new Error(
        'Reminder homologation builds require the staging URL, publishable staging key, and a valid public push key.',
      )
    Object.assign(env, reminderHomologationEnvironment)
  } else if (isCalculatorPreview) {
    if (
      env.VITE_SUPABASE_URL !== `https://${calculatorPreviewProject}.supabase.co` ||
      !env.VITE_SUPABASE_ANON_KEY?.startsWith('sb_publishable_') ||
      hasForbiddenClientKey(env)
    )
      throw new Error(
        'Calculator preview builds require only the homologation URL and a public staging key.',
      )
    Object.assign(env, calculatorPreviewEnvironment)
  } else if (isFoodDiaryPreview || isPhase10And11Preview) {
    if (hasForbiddenClientKey(env))
      throw new Error('Isolated feature previews cannot bundle private client keys.')
    Object.assign(
      env,
      isFoodDiaryPreview
        ? foodDiaryPreviewEnvironment
        : phase10And11PreviewEnvironment,
    )
  } else if (isVercelProduction) {
    if (
      env.VITE_SUPABASE_URL !== `https://${calculatorProductionProject}.supabase.co` ||
      !hasPublicSupabaseKey(env.VITE_SUPABASE_ANON_KEY) ||
      hasForbiddenClientKey(env)
    )
      throw new Error(
        'Production calculator builds require the production URL and only a public Supabase key.',
      )
    Object.assign(env, {
      VITE_CALCULATORS_ENABLED: 'true',
      VITE_HOMOLOGATION_ENABLED: 'false',
      VITE_CLINICAL_INTEGRATION_ENABLED: 'true',
      VITE_CLINICAL_PREVIEW_ENABLED: 'false',
      VITE_PHASE3_PREVIEW_ENABLED: 'false',
      VITE_REMINDERS_HOMOLOGATION_ENABLED: 'false',
      VITE_FOOD_DIARY_ENABLED: 'false',
      VITE_GLP1_TREATMENT_ENABLED: 'false',
      VITE_DEVICE_IMPORT_ENABLED: 'false',
    })
  } else if (isVercelPreview) {
    Object.assign(env, {
      VITE_PHASE3_PREVIEW_ENABLED: 'false',
      VITE_REMINDERS_HOMOLOGATION_ENABLED: 'false',
      VITE_CALCULATORS_ENABLED: 'false',
      VITE_FOOD_DIARY_ENABLED: 'false',
      VITE_GLP1_TREATMENT_ENABLED: 'false',
      VITE_DEVICE_IMPORT_ENABLED: 'false',
    })
  }

  return {
    env,
    isPhase3Preview,
    isReminderHomologationPreview,
    isCalculatorPreview,
    isCalculatorProduction,
    isFoodDiaryPreview,
    isPhase10And11Preview,
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
