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
]

export const test = base.extend({
  ui: async ({ page, context, baseURL }, use) => {
    let active = identities[0]
    const requests = []
    const errors = []
    const failures = []
    const blockedReads = new Set()
    const accounts = new Map(
      identities.map(({ id, name, email }) => [
        id,
        {
          profile: {
            id,
            full_name: name,
            email,
            goal_weight: null,
            weekly_exercise_goal: null,
            sleep_goal_hours: null,
          },
          entries: [],
          logs: [],
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
      expect(url.pathname).toMatch(
        /^\/rest\/v1\/(profiles|metabolic_entries|habit_logs)$/,
      )
      const data = accounts.get(active.id)
      requests.push({ table, method, values: structuredClone(payload) })
      if (method === 'GET') {
        expect(
          url.searchParams.get(table === 'profiles' ? 'id' : 'user_id'),
        ).toBe(`eq.${active.id}`)
        if (table === 'profiles') return reply(data.profile)
        const dateKey =
          table === 'metabolic_entries' ? 'entry_date' : 'logged_at'
        const minimum =
          url.searchParams.get(dateKey)?.replace(/^gte\./, '') || ''
        return reply(
          (table === 'metabolic_entries' ? data.entries : data.logs)
            .filter((item) => item[dateKey] >= minimum)
            .slice()
            .sort((a, b) => b[dateKey].localeCompare(a[dateKey])),
        )
      }
      expect(method).toBe('POST')
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
      identities,
      session,
      data: () => accounts.get(active.id),
      blockReads: (table) => blockedReads.add(table),
      allowReads: (table) => blockedReads.delete(table),
      failNext: (table, method = 'POST', status = 500) =>
        failures.push({ table, method, status }),
      async login(index = 0) {
        await page.goto('/login')
        await page
          .getByLabel('E-mail', { exact: true })
          .fill(identities[index].email)
        await page
          .getByLabel('Senha', { exact: true })
          .fill('Synthetic-password-123!')
        await page.getByRole('button', { name: 'Entrar', exact: true }).click()
        await expect(page.getByRole('navigation')).toBeVisible()
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
