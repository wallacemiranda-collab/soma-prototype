export function isPhase3PreviewHost(hostname) {
  return (
    ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ||
    /^soma-prototype-nc87-(?:[a-z0-9]+|git-codex-fase3-previa)-wallace-miranda-s-projects\.vercel\.app$/.test(
      hostname,
    )
  )
}

export function readPhase3Preview(env = {}, hostname = '') {
  const requested = env.VITE_PHASE3_PREVIEW_ENABLED === 'true'
  const previewHost = isPhase3PreviewHost(hostname)
  const allowed =
    requested &&
    previewHost &&
    !String(env.VITE_SUPABASE_URL || '').trim() &&
    !String(env.VITE_SUPABASE_ANON_KEY || '').trim() &&
    env.VITE_HOMOLOGATION_ENABLED !== 'true' &&
    env.VITE_CLINICAL_INTEGRATION_ENABLED !== 'true' &&
    env.VITE_GOOGLE_AUTH_ENABLED !== 'true'
  return { requested, allowed }
}
