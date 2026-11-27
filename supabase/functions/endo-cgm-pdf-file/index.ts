import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

const bucket = 'endo-cgm-libre-pdf'
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuidText = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const storedPathPattern = new RegExp(`^${uuidText}/${uuidText}\\.pdf$`, 'i')

function allowedOrigin(origin: string) {
  const configured = (Deno.env.get('CGM_PDF_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if (configured.includes(origin)) return true
  try {
    const url = new URL(origin)
    if (url.protocol === 'http:' && ['localhost:5173', '127.0.0.1:5173'].includes(url.host)) return true
    return url.protocol === 'https:' && (
      url.hostname === 'endoplus.vercel.app'
      || /^soma-prototype-[a-z0-9-]+-wallace-miranda-s-projects\.vercel\.app$/i.test(url.hostname)
      || /^endoplus-[a-z0-9-]+-wallace-miranda-s-projects\.vercel\.app$/i.test(url.hostname)
    )
  } catch {
    return false
  }
}

function responseHeaders(origin: string | null) {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
  })
  if (origin && allowedOrigin(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info')
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    headers.set('Access-Control-Max-Age', '86400')
  }
  return headers
}

function json(status: number, body: Record<string, unknown>, origin: string | null) {
  const headers = responseHeaders(origin)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { status, headers })
}

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value)
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')
  const headers = responseHeaders(origin)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin)
  if (origin && !allowedOrigin(origin)) return json(403, { error: 'origin_not_allowed' }, origin)
  const authorization = request.headers.get('authorization')
  const url = Deno.env.get('SUPABASE_URL')
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authorization?.startsWith('Bearer ') || !url || !publicKey || !serviceKey) {
    return json(401, { error: 'authentication_required' }, origin)
  }

  let payload: Record<string, unknown>
  try {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return json(415, { error: 'json_required' }, origin)
    }
    const body = await request.text()
    if (new TextEncoder().encode(body).length > 4096) return json(413, { error: 'request_too_large' }, origin)
    payload = JSON.parse(body)
  } catch {
    return json(400, { error: 'invalid_request' }, origin)
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json(400, { error: 'invalid_request' }, origin)
  }

  const action = payload.action
  const isRead = action === 'read'
  const isDelete = action === 'delete-all'
  const expectedKeys = isRead ? ['action', 'report_id', 'request_id'] : ['action', 'request_id']
  if ((!isRead && !isDelete) || !exactKeys(payload, expectedKeys)
    || typeof payload.request_id !== 'string' || !uuidPattern.test(payload.request_id)
    || (isRead && (typeof payload.report_id !== 'string' || !uuidPattern.test(payload.report_id)))) {
    return json(400, { error: 'invalid_request' }, origin)
  }

  const userClient = createClient(url, publicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user?.id) return json(401, { error: 'authentication_required' }, origin)

  const adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  if (isRead) {
    const { data: path, error: accessError } = await userClient.rpc('endo_authorize_cgm_pdf_file_access', {
      p_actor_id: authData.user.id,
      p_report_id: payload.report_id,
      p_request_id: payload.request_id,
      p_action: 'read',
    })
    if (accessError || typeof path !== 'string' || !storedPathPattern.test(path)) {
      return json(403, { error: 'report_access_denied' }, origin)
    }
    const { data: file, error: downloadError } = await adminClient.storage.from(bucket).download(path)
    if (downloadError || !file || file.size > 10_000_000) {
      return json(404, { error: 'report_not_available' }, origin)
    }
    const fileHeaders = responseHeaders(origin)
    fileHeaders.set('Content-Type', 'application/pdf')
    fileHeaders.set('Content-Disposition', 'inline; filename="relatorio-libreview.pdf"')
    return new Response(file, { status: 200, headers: fileHeaders })
  }

  const { data: staged, error: stageError } = await userClient.rpc('endo_stage_delete_cgm_pdf_reports', {
    p_actor_id: authData.user.id,
    p_request_id: payload.request_id,
  })
  if (stageError || !staged || !Array.isArray(staged.paths)
    || staged.paths.some((path: unknown) => typeof path !== 'string'
      || !path.startsWith(`${authData.user.id}/`) || !path.endsWith('.pdf'))) {
    return json(403, { error: 'report_deletion_denied' }, origin)
  }

  const paths = new Set<string>(staged.paths)
  for (let offset = 0; ; offset += 100) {
    const { data: objects, error: listError } = await adminClient.storage.from(bucket).list(authData.user.id, {
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (listError || !objects) return json(503, { error: 'report_deletion_pending' }, origin)
    for (const object of objects) {
      if (uuidPattern.test(object.name.replace(/\.pdf$/i, '')) && object.name.toLowerCase().endsWith('.pdf')) {
        paths.add(`${authData.user.id}/${object.name}`)
      }
    }
    if (objects.length < 100) break
    if (offset >= 9900) return json(503, { error: 'report_deletion_pending' }, origin)
  }
  const pathsToRemove = [...paths]
  if (pathsToRemove.some((path) => !path.startsWith(`${authData.user.id}/`) || !storedPathPattern.test(path))) {
    return json(403, { error: 'report_deletion_denied' }, origin)
  }
  for (let start = 0; start < pathsToRemove.length; start += 100) {
    const { error: removeError } = await adminClient.storage.from(bucket).remove(pathsToRemove.slice(start, start + 100))
    if (removeError) return json(503, { error: 'report_deletion_pending' }, origin)
  }
  const { data: result, error: finalizeError } = await userClient.rpc('endo_finalize_delete_cgm_pdf_reports', {
    p_actor_id: authData.user.id,
    p_request_id: payload.request_id,
  })
  if (finalizeError) return json(503, { error: 'report_deletion_pending' }, origin)
  return json(200, result ?? { deleted: 0 }, origin)
})
