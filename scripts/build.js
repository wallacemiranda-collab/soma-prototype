import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const phase3Branch = 'codex/fase3-previa'
const calculatorPreviewBranches = new Set([
  'codex/fase8-privacidade',
  'codex/publicar-calculadoras',
  'codex/prevent-frax-mayo-findrisc',
])
const calculatorPreviewProject = 'ctcsolobseerqnddahun'
const calculatorProductionProject = 'trlwhngxqfgksiponpzk'
const cgmPilotBranch = 'codex/cgm-patient-pilot'
const cgmPilotEnvironment = {
  VITE_CALCULATORS_ENABLED: 'false',
  VITE_PATIENT_CALCULATORS_ENABLED: 'true',
  VITE_GLP1_TREATMENT_ENABLED: 'false',
  VITE_DEVICE_IMPORT_ENABLED: 'false',
  VITE_CGM_PILOT_ENABLED: 'true',
  VITE_HOMOLOGATION_ENABLED: 'true',
  VITE_CLINICAL_INTEGRATION_ENABLED: 'true',
  VITE_CLINICAL_PREVIEW_ENABLED: 'false',
  VITE_PHASE3_PREVIEW_ENABLED: 'false',
  VITE_REMINDERS_HOMOLOGATION_ENABLED: 'false',
  VITE_GOOGLE_AUTH_ENABLED: 'false',
}
const phase3Environment = {
  VITE_PATIENT_CALCULATORS_ENABLED: 'false',
  VITE_PHASE3_PREVIEW_ENABLED: 'true',
  VITE_GLP1_TREATMENT_ENABLED: 'false',
  VITE_DEVICE_IMPORT_ENABLED: 'false',
  VITE_CGM_PILOT_ENABLED: 'false',
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
  VITE_HOMOLOGATION_ENABLED: 'false',
  VITE_CLINICAL_PREVIEW_ENABLED: 'false',
  VITE_CLINICAL_INTEGRATION_ENABLED: 'false',
  VITE_GOOGLE_AUTH_ENABLED: 'false',
}
const calculatorPreviewEnvironment = {
  VITE_CALCULATORS_ENABLED: 'true',
  VITE_GLP1_TREATMENT_ENABLED: 'false',
  VITE_DEVICE_IMPORT_ENABLED: 'false',
  VITE_CGM_PILOT_ENABLED: 'false',
  VITE_HOMOLOGATION_ENABLED: 'true',
  VITE_CLINICAL_INTEGRATION_ENABLED: 'true',
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

  const isPhase3Preview =
    isVercelPreview && env.VERCEL_GIT_COMMIT_REF === phase3Branch
  const isCgmPilotPreview =
    isVercelPreview && env.VERCEL_GIT_COMMIT_REF === cgmPilotBranch
  const isCalculatorPreview =
    isVercelPreview && calculatorPreviewBranches.has(env.VERCEL_GIT_COMMIT_REF)
  const isCalculatorProduction = isVercelProduction

  if (isPhase3Preview) Object.assign(env, phase3Environment)
  else if (isCgmPilotPreview) {
    if (
      env.VITE_SUPABASE_URL !== `https://${calculatorPreviewProject}.supabase.co` ||
      !env.VITE_SUPABASE_ANON_KEY?.startsWith('sb_publishable_') ||
      hasForbiddenClientKey(env)
    )
      throw new Error(
        'CGM pilot preview builds require only the homologation URL and a public staging key.',
      )
    Object.assign(env, cgmPilotEnvironment)
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
  } else if (isCalculatorProduction) {
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
      VITE_PATIENT_CALCULATORS_ENABLED: 'false',
      VITE_HOMOLOGATION_ENABLED: 'false',
      VITE_CLINICAL_INTEGRATION_ENABLED: 'true',
      VITE_CLINICAL_PREVIEW_ENABLED: 'false',
      VITE_PHASE3_PREVIEW_ENABLED: 'false',
      VITE_REMINDERS_HOMOLOGATION_ENABLED: 'false',
      VITE_GLP1_TREATMENT_ENABLED: 'false',
      VITE_DEVICE_IMPORT_ENABLED: 'false',
      VITE_CGM_PILOT_ENABLED: 'false',
    })
  } else if (isVercelPreview) {
    env.VITE_PHASE3_PREVIEW_ENABLED = 'false'
    env.VITE_REMINDERS_HOMOLOGATION_ENABLED = 'false'
    env.VITE_CALCULATORS_ENABLED = 'false'
    env.VITE_PATIENT_CALCULATORS_ENABLED = 'false'
    env.VITE_GLP1_TREATMENT_ENABLED = 'false'
    env.VITE_DEVICE_IMPORT_ENABLED = 'false'
    env.VITE_CGM_PILOT_ENABLED = 'false'
  }

  return {
    env,
    isPhase3Preview,
    isCgmPilotPreview,
    isCalculatorPreview,
    isCalculatorProduction,
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
