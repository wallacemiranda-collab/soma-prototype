export function readBackendConfig(env = {}) {
  const url =
    typeof env.VITE_SUPABASE_URL === 'string'
      ? env.VITE_SUPABASE_URL.trim()
      : ''
  const key =
    typeof env.VITE_SUPABASE_ANON_KEY === 'string'
      ? env.VITE_SUPABASE_ANON_KEY.trim()
      : ''
  let publicKey = key.startsWith('sb_publishable_')
  if (!publicKey && key.split('.').length === 3) {
    try {
      const payload = JSON.parse(
        atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
      )
      publicKey = payload.role === 'anon'
    } catch {
      publicKey = false
    }
  }
  let validUrl = false
  try {
    const parsed = new URL(url)
    validUrl =
      parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(parsed.hostname))
  } catch {
    validUrl = false
  }
  return {
    url,
    key,
    configured: Boolean(validUrl && publicKey && !url.includes('seu-projeto')),
  }
}
