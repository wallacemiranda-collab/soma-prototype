import { test as base, expect } from '@playwright/test'
import { testBackend } from '../../playwright.config.js'

const identities = [
  {
    id: 'dcb6ee19-8ff9-41ac-85f8-7338568e94d2',
    name: 'Ana teste',
    email: 'ana@example.invalid',
  },
  {
    id: 'bcb2a854-0fab-46fe-a7b3-bce883706936',
    name: 'Bruno teste',
    email: 'bruno@example.invalid',
  },
  {
    id: 'db3f8eb5-0611-48c7-b24d-4c2618222f8e',
    name: 'Carla teste',
    email: 'carla@example.invalid',
  },
  {
    id: 'c04a7b3c-2949-4a0e-a962-6bf49700cbdd',
    name: 'Daniel teste',
    email: 'daniel@example.invalid',
  },
  {
    id: '7d7985af-5730-4b78-8054-cb0289b5776e',
    name: 'Eva teste',
    email: 'eva@example.invalid',
  },
  {
    id: '1f7e9038-2309-4a30-9b22-22f4624e9b11',
    name: 'Fabi teste',
    email: 'fabi@example.invalid',
  },
]

export const test = base.extend({
  ui: async ({ page, context, baseURL }, use) => {
    let active = identities[0]
    const requests = []
    const errors = []
    const failures = []
    const blockedReads = new Set()
    const shares = new Map()
    const codeReservations = new Map()
    const allowed = (patientId) => {
      const share = shares.get(`${patientId}:${active.id}`)
      return Boolean(
        share &&
          !share.revoked_at &&
          (!share.expires_at || Date.parse(share.expires_at) > Date.now()),
      )
    }
    const accounts = new Map(
      identities.map(({ id, name, email }) => [
        id,
        {
          profile: {
            id,
            full_name: name,
            email,
            birth_date: null,
            sex: null,
            goal_weight: null,
            weekly_exercise_goal: null,
            sleep_goal_hours: null,
          },
          entries: [],
          logs: [],
          doctorProfile: null,
        },
      ]),
    )
    const user = () => ({
      id: active.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: active.email,
      user_metadata: { full_name: active.name },
    })
    const session = () => {
      const encode = (value) =>
        Buffer.from(JSON.stringify(value)).toString('base64url')
      const now = Math.floor(Date.now() / 1000)
      return {
        access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: active.id, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600 })}.synthetic-signature`,
        refresh_token: 'synthetic-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: user(),
      }
    }
    page.on('pageerror', (error) => errors.push(error.message))
    await context.route(`${testBackend}/**`, async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const method = request.method()
      const headers = {
        'access-control-allow-origin': baseURL,
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers':
          request.headers()['access-control-request-headers'] || '*',
      }
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers })
      const reply = (json, status = 200) =>
        route.fulfill({ status, json, headers })
      const table = url.pathname.split('/').at(-1)
      if (method === 'GET' && blockedReads.has(table))
        return reply(
          { code: 'TEST_FAILURE', message: 'Synthetic read failure' },
          403,
        )
      const failure = failures.findIndex(
        (item) => item.table === table && item.method === method,
      )
      if (failure !== -1) {
        const [fault] = failures.splice(failure, 1)
        return reply(
          { code: 'TEST_FAILURE', message: 'Synthetic request failure' },
          fault.status,
        )
      }
      const payload = ['POST', 'PUT', 'PATCH'].includes(method)
        ? request.postDataJSON()
        : null
      if (url.pathname === '/auth/v1/token') {
        if (payload?.email) {
          const found = identities.find(
            (identity) => identity.email === payload.email,
          )
          if (!found)
            return reply(
              {
                code: 'invalid_credentials',
                message: 'Invalid login credentials',
              },
              400,
            )
          active = found
        }
        return reply(session())
      }
      if (url.pathname === '/auth/v1/user') return reply(user())
      if (url.pathname === '/auth/v1/logout')
        return route.fulfill({ status: 204, headers })
      if (url.pathname === '/auth/v1/signup')
        return reply({ user: user(), session: null })
      if (url.pathname === '/auth/v1/recover') return reply({})
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        requests.push({ table, method, values: structuredClone(payload) })
        if (table === 'endo_lookup_professional') {
          const profile = [...accounts.values()]
            .map((account) => account.doctorProfile)
            .find((doctor) => doctor?.share_code === payload.p_code)
          return reply(
            profile
              ? [
                  {
                    doctor_id: profile.user_id,
                    professional_name: profile.professional_name,
                    profession: profile.profession ?? 'Medicina',
                    council: profile.council ?? 'CRM',
                    crm: profile.crm,
                    crm_state: profile.crm_state,
                  },
                ]
              : [],
          )
        }
        if (table === 'endo_my_professionals')
          return reply(
            [...shares.values()]
              .filter((share) => share.patient_id === active.id)
              .map((share) => ({
                profession: 'Medicina',
                council: 'CRM',
                ...share,
                ...accounts.get(share.doctor_id).doctorProfile,
              })),
          )
        if (table === 'endo_my_patients')
          return reply(
            [...shares.values()]
              .filter(
                (share) =>
                  share.doctor_id === active.id && allowed(share.patient_id),
              )
              .map((share) => ({
                ...share,
                full_name: accounts.get(share.patient_id).profile.full_name,
              })),
          )
        if (table === 'endo_can_read_patient')
          return reply(allowed(payload.p_patient_id))
        if (table === 'endo_shared_profile') {
          if (!allowed(payload.p_patient_id))
            return reply({ message: 'Patient authorization required' }, 403)
          const { email, ...profile } = accounts.get(
            payload.p_patient_id,
          ).profile
          return reply([profile])
        }
        if (table === 'endo_grant_doctor_access') {
          if (
            !accounts.get(payload.p_doctor_id)?.doctorProfile ||
            payload.p_doctor_id === active.id
          )
            return reply({ message: 'Invalid doctor' }, 400)
          shares.set(`${active.id}:${payload.p_doctor_id}`, {
            patient_id: active.id,
            doctor_id: payload.p_doctor_id,
            granted_at: new Date().toISOString(),
            expires_at:
              payload.p_days === null
                ? null
                : new Date(
                    Date.now() + payload.p_days * 86400000,
                  ).toISOString(),
            revoked_at: null,
          })
          return reply(null)
        }
        if (table === 'endo_revoke_doctor_access') {
          const share = shares.get(`${active.id}:${payload.p_doctor_id}`)
          if (share) share.revoked_at = new Date().toISOString()
          return reply(null)
        }
        throw new Error(`Unexpected RPC: ${table}`)
      }
      expect(url.pathname).toMatch(
        /^\/rest\/v1\/(profiles|metabolic_entries|habit_logs|doctor_profiles)$/,
      )
      const data = accounts.get(active.id)
      requests.push({ table, method, values: structuredClone(payload) })
      if (method === 'GET') {
        const target = url.searchParams
          .get(table === 'profiles' ? 'id' : 'user_id')
          ?.replace(/^eq\./, '')
        if (table === 'doctor_profiles') {
          expect(target).toBe(active.id)
          return reply(data.doctorProfile)
        }
        if (target !== active.id && (table === 'profiles' || !allowed(target)))
          return reply([])
        if (table === 'profiles') return reply(data.profile)
        const dateKey =
          table === 'metabolic_entries' ? 'entry_date' : 'logged_at'
        const minimum =
          url.searchParams.get(dateKey)?.replace(/^gte\./, '') || ''
        return reply(
          (table === 'metabolic_entries'
            ? accounts.get(target).entries
            : accounts.get(target).logs
          )
            .filter((item) => item[dateKey] >= minimum)
            .slice()
            .sort((a, b) => b[dateKey].localeCompare(a[dateKey]))
            .slice(
              Number(url.searchParams.get('offset') || 0),
              Number(url.searchParams.get('offset') || 0) +
                Number(url.searchParams.get('limit') || 500),
            ),
        )
      }
      if (method === 'PATCH' && table === 'doctor_profiles') {
        expect(url.searchParams.get('user_id')).toBe(`eq.${active.id}`)
        expect(Object.keys(payload)).toEqual(['share_code'])
        const code = payload.share_code
        if (!/^[A-Z0-9]{6,24}$/.test(code))
          return reply({ code: '23514', message: 'Invalid code' }, 400)
        const owner = codeReservations.get(code)
        if (owner !== undefined && owner !== active.id)
          return reply({ code: '23505', message: 'Code unavailable' }, 409)
        codeReservations.set(code, active.id)
        data.doctorProfile = { ...data.doctorProfile, share_code: code }
        return reply(data.doctorProfile)
      }
      expect(method).toBe('POST')
      if (table === 'doctor_profiles') {
        expect(payload.user_id).toBe(active.id)
        data.doctorProfile = {
          ...payload,
          share_code:
            active.id === identities[2].id
              ? 'ABCDEF1234567890'
              : '1234567890ABCDEF',
        }
        codeReservations.set(data.doctorProfile.share_code, active.id)
        return reply(data.doctorProfile)
      }
      if (table === 'profiles') {
        expect(payload.id).toBe(active.id)
        expect(url.searchParams.get('on_conflict')).toBe('id')
        data.profile = { ...data.profile, ...payload }
        return reply(data.profile)
      }
      expect(payload.user_id).toBe(active.id)
      const rows = table === 'metabolic_entries' ? data.entries : data.logs
      const dateKey = table === 'metabolic_entries' ? 'entry_date' : 'logged_at'
      expect(url.searchParams.get('on_conflict')).toBe(
        table === 'metabolic_entries'
          ? 'user_id,entry_date'
          : 'user_id,logged_at,habit_key',
      )
      let row = rows.find(
        (item) =>
          item[dateKey] === payload[dateKey] &&
          (table === 'metabolic_entries' ||
            item.habit_key === payload.habit_key),
      )
      if (!row) {
        row = { id: crypto.randomUUID() }
        rows.push(row)
      }
      Object.assign(row, payload)
      return reply(row)
    })
    await use({
      requests,
      accounts,
      shares,
      codeReservations,
      identities,
      session,
      data: () => accounts.get(active.id),
      blockReads: (table) => blockedReads.add(table),
      allowReads: (table) => blockedReads.delete(table),
      failNext: (table, method = 'POST', status = 500) =>
        failures.push({ table, method, status }),
      async login(index = 0, mode = 'patient') {
        await page.goto(
          `/login?acesso=${mode === 'doctor' ? 'medico' : 'paciente'}`,
        )
        await page
          .getByLabel('E-mail', { exact: true })
          .fill(identities[index].email)
        await page
          .getByLabel('Senha', { exact: true })
          .fill('Synthetic-password-123!')
        await page.getByRole('button', { name: 'Entrar', exact: true }).click()
        await expect(page.getByRole('navigation')).toBeVisible()
        if (mode === 'doctor') return
        await page
          .getByRole('navigation')
          .getByRole('link', { name: 'Início', exact: true })
          .click()
        await expect(
          page.getByRole('heading', {
            name: `${identities[index].name.split(' ')[0]}!`,
            exact: true,
          }),
        ).toBeVisible()
      },
      async record() {
        await page.goto('/registro')
        await expect(
          page.getByLabel('Peso (kg)', { exact: true }),
        ).toBeVisible()
      },
    })
    expect(errors, 'uncaught browser exceptions').toEqual([])
  },
})

export { expect }
