import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import {
  genericReminderPayload,
  isAllowedWebPushEndpoint,
} from './pushGuards.js'

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

async function secretsMatch(provided: string, expected: string) {
  const encoder = new TextEncoder()
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const a = new Uint8Array(left)
  const b = new Uint8Array(right)
  let difference = 0
  for (let index = 0; index < a.length; index += 1)
    difference |= a[index] ^ b[index]
  return difference === 0 && provided.length > 0 && expected.length > 0
}

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return response(405, { error: 'method_not_allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey)
    return response(503, { error: 'server_configuration_missing' })

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: expectedToken, error: tokenError } = await client.rpc(
    'endo_reminder_dispatch_token',
  )
  const providedToken = request.headers.get('x-endo-dispatch-token') ?? ''
  if (tokenError || typeof expectedToken !== 'string')
    return response(503, { error: 'dispatch_configuration_missing' })
  if (!(await secretsMatch(providedToken, expectedToken)))
    return response(401, { error: 'unauthorized' })

  const { data: deliveries, error: claimError } = await client.rpc(
    'endo_claim_due_patient_reminder_deliveries',
    { p_limit: 50 },
  )
  if (claimError) return response(500, { error: 'queue_unavailable' })
  if (!deliveries?.length) return response(200, { processed: 0 })

  const { data: credentials, error: credentialError } = await client.rpc(
    'endo_reminder_vapid_credentials',
  )
  if (credentialError || !credentials?.publicKey || !credentials?.privateKey)
    return response(503, { error: 'push_configuration_missing' })

  webpush.setVapidDetails(
    'https://endoplus.vercel.app',
    credentials.publicKey,
    credentials.privateKey,
  )

  let sent = 0
  let failed = 0
  let expired = 0
  for (let offset = 0; offset < deliveries.length; offset += 8) {
    const batch = deliveries.slice(offset, offset + 8)
    await Promise.all(
      batch.map(async (delivery: {
        delivery_id: string
        subscription_id: string
        endpoint: string
        p256dh: string
        auth_secret: string
      }) => {
        let outcome: 'sent' | 'failed' | 'expired' = 'failed'
        let responseStatus: number | null = null
        try {
          if (!isAllowedWebPushEndpoint(delivery.endpoint)) {
            outcome = 'expired'
            responseStatus = 400
          } else {
            await webpush.sendNotification(
              {
                endpoint: delivery.endpoint,
                keys: { p256dh: delivery.p256dh, auth: delivery.auth_secret },
              },
              genericReminderPayload(),
              { TTL: 60, urgency: 'normal', timeout: 10000 },
            )
            outcome = 'sent'
            responseStatus = 201
          }
        } catch (error) {
          const status = Number((error as { statusCode?: unknown })?.statusCode)
          responseStatus = Number.isInteger(status) && status >= 100 && status <= 599
            ? status
            : null
          outcome = status === 404 || status === 410 ? 'expired' : 'failed'
        }

        const { error: finishError } = await client.rpc(
          'endo_finish_patient_reminder_delivery',
          {
            p_delivery_id: delivery.delivery_id,
            p_result: outcome,
            p_response_status: responseStatus,
          },
        )
        if (finishError) {
          failed += 1
          return
        }
        if (outcome === 'sent') sent += 1
        else if (outcome === 'expired') expired += 1
        else failed += 1
      }),
    )
  }

  return response(200, { processed: deliveries.length, sent, failed, expired })
})
