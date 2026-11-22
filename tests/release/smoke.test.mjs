import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium, expect } from '@playwright/test'

const config = JSON.parse(readFileSync(process.env.ENDO_RELEASE_CONFIG, 'utf8'))
const production = 'https://trlwhngxqfgksiponpzk.supabase.co'
const entry = new URL(config.url)
if (
  config.backend !== production ||
  entry.protocol !== 'https:' ||
  !(
    entry.hostname === 'endoplus.vercel.app' ||
    /^soma-prototype-nc87-[a-z0-9]+-wallace-miranda-s-projects\.vercel\.app$/.test(
      entry.hostname,
    )
  )
)
  throw new Error('Release smoke guard: unexpected destination.')

test(
  'production-configured release: public guards, isolated demo and mocked authenticated clinical UI',
  { timeout: 120000 },
  async (t) => {
    const browser = await chromium.launch({
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    })
    const id = '11111111-1111-4111-8111-111111111111'
    const user = {
      id,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'browser-only@example.invalid',
      user_metadata: { full_name: 'Interface de teste local' },
    }
    async function visit(mock, work) {
      const context = await browser.newContext({
        viewport: { width: 320, height: 780 },
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
      })
      const forbidden = [],
        calls = [],
        errors = []
      // All backend traffic is intercepted. This test cannot create production accounts or rows.
      await context.route('**/*', async (route) => {
        const request = route.request(),
          url = new URL(request.url())
        if (!url.hostname.endsWith('.supabase.co')) return route.continue()
        if (url.origin !== production || !mock) {
          forbidden.push(url.pathname)
          return route.abort()
        }
        const headers = {
          'access-control-allow-origin': entry.origin,
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
        }
        if (request.method() === 'OPTIONS')
          return route.fulfill({ status: 204, headers })
        calls.push(url.pathname)
        const reply = (json) => route.fulfill({ status: 200, headers, json })
        if (url.pathname === '/auth/v1/user' && request.method() === 'GET')
          return reply(user)
        if (url.pathname === '/auth/v1/logout')
          return route.fulfill({ status: 204, headers })
        if (url.pathname === '/rest/v1/rpc/endo_clinical_overview')
          return reply({ modules: [], permissions: [] })
        if (url.pathname === '/rest/v1/rpc/endo_my_professionals')
          return reply([])
        if (request.method() === 'GET' && url.pathname === '/rest/v1/profiles')
          return reply({
            id,
            full_name: 'Interface de teste local',
            email: user.email,
            height_cm: null,
          })
        if (
          request.method() === 'GET' &&
          /^\/rest\/v1\/(metabolic_entries|habit_logs|doctor_profiles|clinical_module_versions|clinical_record_corrections|glucose_readings|hypoglycemia_events|hba1c_results|injection_logs|gi_symptom_logs|thyroid_intakes|blood_pressure_readings)$/.test(
            url.pathname,
          )
        )
          return reply([])
        forbidden.push(`${request.method()} ${url.pathname}`)
        return route.fulfill({
          status: 403,
          headers,
          json: {
            code: 'TEST_BLOCKED',
            message: 'Real backend access blocked by release test',
          },
        })
      })
      if (mock) {
        const now = Math.floor(Date.now() / 1000)
        const encode = (value) =>
          Buffer.from(JSON.stringify(value)).toString('base64url')
        const session = {
          access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600 })}.synthetic-signature`,
          refresh_token: 'browser-only-not-real',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: now + 3600,
          user,
        }
        await context.addInitScript(
          ({ origin, session }) => {
            if (location.origin === origin)
              localStorage.setItem(
                'sb-trlwhngxqfgksiponpzk-auth-token',
                JSON.stringify(session),
              )
          },
          { origin: entry.origin, session },
        )
      }
      const page = await context.newPage()
      page.on('pageerror', (error) => errors.push(error.message))
      try {
        const response = await page.goto(entry.href)
        assert.equal(response.status(), 200)
        await work(page, calls)
        assert.deepEqual(forbidden, [])
        assert.deepEqual(errors, [])
      } finally {
        await context.close()
      }
    }
    try {
      await t.test(
        'normal login has no homologation banner and the new private routes require authentication',
        () =>
          visit(false, async (page) => {
            await expect(
              page.getByRole('button', { name: 'Entrar', exact: true }),
            ).toBeEnabled({ timeout: 20000 })
            await expect(
              page.getByRole('complementary', { name: 'Ambiente de testes' }),
            ).toHaveCount(0)
            assert.ok(!(await page.title()).includes('[Prévia]'))
            await page.goto(entry.origin + '/cuidados')
            await expect(page).toHaveURL(/\/login$/)
            await page.goto(
              entry.origin + `/profissional/pacientes/${id}/cuidados`,
            )
            await expect(page).toHaveURL(/\/login$/)
            await expect(
              page.getByRole('button', {
                name: 'Sou profissional de saúde',
                exact: true,
              }),
            ).toHaveAttribute('aria-pressed', 'true')
          }),
      )
      await t.test(
        'demo remains isolated from all production backend requests',
        () =>
          visit(false, async (page) => {
            await page
              .getByRole('button', { name: 'Explorar demonstração' })
              .click()
            await expect(page).toHaveURL(/\/home$/)
            await page.goto(entry.origin + '/evolucao')
            await expect(
              page.getByText('Demonstração · dados fictícios'),
            ).toBeVisible()
            await page.goto(entry.origin + '/cuidados')
            await expect(
              page.getByRole('heading', { name: 'Integração em preparação' }),
            ).toBeVisible()
            assert.ok(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
              ),
            )
          }),
      )
      await t.test(
        'clinical integration is enabled in the published bundle, using only a browser-local mocked identity',
        () =>
          visit(true, async (page, calls) => {
            await page.goto(entry.origin + '/cuidados')
            await expect(
              page.getByRole('heading', {
                name: 'Meus acompanhamentos',
                exact: true,
              }),
            ).toBeVisible({ timeout: 20000 })
            await expect(
              page
                .getByRole('status')
                .filter({ hasText: 'Nenhum módulo clínico ativo' }),
            ).toBeVisible()
            assert.ok(calls.includes('/rest/v1/rpc/endo_clinical_overview'))
            assert.ok(calls.includes('/rest/v1/clinical_record_corrections'))
          }),
      )
    } finally {
      await browser.close()
    }
  },
)
