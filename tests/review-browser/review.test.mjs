import test from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { loadReviewAccess } from '../staging/reviewAccess.mjs'

test(
  'protected Endo + review: synthetic accounts, banner, corrections and medical read-only access',
  { timeout: 180000 },
  async (t) => {
    const config = loadReviewAccess()
    const account = (role) => config.accounts.find((row) => row.role === role)
    const browser = await chromium.launch({
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    })
    async function visit(role, work) {
      const context = await browser.newContext({
        viewport: { width: 320, height: 780 },
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
      })
      const page = await context.newPage()
      const forbidden = [],
        errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url())
        if (
          (url.hostname.endsWith('.supabase.co') &&
            url.origin !== config.url) ||
          (url.hostname.endsWith('.vercel.app') &&
            url.origin !== config.review.origin) ||
          /^\/auth\/v1\/(signup|recover|otp|invite|resend|magiclink)(\/|$)/.test(
            url.pathname,
          )
        ) {
          forbidden.push(url.pathname)
          return route.abort()
        }
        return route.continue()
      })
      try {
        const response = await page.goto(config.review.url)
        assert.equal(response.status(), 200)
        assert.match(response.headers()['x-robots-tag'] || '', /noindex/)
        await expect(
          page.getByRole('complementary', { name: 'Ambiente de testes' }),
        ).toBeVisible({ timeout: 20000 })
        if (role) {
          await page.goto(
            `${config.review.origin}/login?acesso=${role === 'patient' || role === 'otherPatient' ? 'paciente' : 'profissional'}`,
          )
          const identity = account(role)
          await page.getByLabel('E-mail', { exact: true }).fill(identity.email)
          await page
            .getByLabel('Senha', { exact: true })
            .evaluate((input, password) => {
              Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value',
              ).set.call(input, password)
              input.dispatchEvent(new Event('input', { bubbles: true }))
            }, identity.password)
          await page
            .getByRole('button', { name: 'Entrar', exact: true })
            .click()
          await expect(page).toHaveURL(
            role === 'patient' || role === 'otherPatient'
              ? /\/home$/
              : /\/profissional$/,
            { timeout: 20000 },
          )
        }
        await work(page)
        assert.deepEqual(forbidden, [])
        assert.deepEqual(errors, [])
      } finally {
        if (page.url().startsWith(config.review.origin))
          await page
            .evaluate(
              async ({ url, key }) => {
                const stored = localStorage.getItem(
                  'sb-ctcsolobseerqnddahun-auth-token',
                )
                const token = stored && JSON.parse(stored).access_token
                if (token)
                  await fetch(`${url}/auth/v1/logout`, {
                    method: 'POST',
                    headers: { apikey: key, Authorization: `Bearer ${token}` },
                  })
              },
              { url: config.url, key: config.publishable_key },
            )
            .catch(() => {})
        await context.close()
      }
    }
    try {
      await t.test(
        'the published preview hides signup/recovery and refuses real account credentials without an Auth request',
        () =>
          visit(null, async (page) => {
            await expect(
              page.getByLabel('E-mail', { exact: true }),
            ).toBeVisible({ timeout: 20000 })
            await expect(
              page.getByRole('button', { name: 'Criar conta', exact: true }),
            ).toHaveCount(0)
            await expect(
              page.getByRole('button', { name: 'Esqueci minha senha' }),
            ).toHaveCount(0)
            let authRequests = 0
            page.on('request', (request) => {
              if (new URL(request.url()).pathname.startsWith('/auth/v1/'))
                authRequests++
            })
            await page
              .getByLabel('E-mail', { exact: true })
              .fill('real-account@example.com')
            await page
              .getByLabel('Senha', { exact: true })
              .fill('not-a-real-password')
            await page
              .getByRole('button', { name: 'Entrar', exact: true })
              .click()
            await expect(page.getByRole('alert')).toBeVisible()
            assert.equal(authRequests, 0)
            await expect(page).toHaveTitle(/\[Prévia\]/)
          }),
      )
      await t.test(
        'patient corrections survive a reload and retain the original and reason on a narrow screen',
        () =>
          visit('patient', async (page) => {
            await page.goto(`${config.review.origin}/cuidados`)
            const history = page.getByRole('region', {
              name: 'Histórico clínico',
            })
            const first = history
              .locator('article')
              .filter({
                has: page.getByRole('heading', {
                  name: 'Glicemia capilar',
                  exact: true,
                }),
              })
              .first()
            await first
              .getByRole('button', { name: 'Corrigir registro', exact: true })
              .click({ timeout: 20000 })
            const editor = page.getByRole('form', {
              name: 'Corrigir registro clínico',
            })
            await editor
              .getByLabel('Glicemia (mg/dL)', { exact: true })
              .fill('139')
            await editor
              .getByLabel('Motivo da correção')
              .fill('Exemplo fictício de correção para revisão')
            await editor
              .getByRole('button', { name: 'Salvar correção', exact: true })
              .click()
            await expect(
              page.getByRole('status').filter({ hasText: 'Correção salva.' }),
            ).toBeVisible({ timeout: 20000 })
            await page.reload()
            const changed = history
              .locator('article')
              .filter({ hasText: '139' })
            await changed
              .getByText('Ver original e alterações (1)', { exact: true })
              .click({ timeout: 20000 })
            await expect(changed).toContainText(
              'Exemplo fictício de correção para revisão',
            )
            assert.ok(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
              ),
            )
          }),
      )
      await t.test(
        'the authorized physician sees the audit trail without controls to edit patient observations',
        () =>
          visit('doctor', async (page) => {
            await page.goto(
              `${config.review.origin}/profissional/pacientes/${account('patient').id}/cuidados`,
            )
            const history = page.getByRole('region', {
              name: 'Histórico clínico',
            })
            await expect(history).toContainText('139', { timeout: 20000 })
            await expect(history.locator('button,input')).toHaveCount(0)
            await history
              .locator('article')
              .filter({ hasText: '139' })
              .getByText('Ver original e alterações (1)', { exact: true })
              .click()
            await expect(history).toContainText(
              'Exemplo fictício de correção para revisão',
            )
            await expect(
              page.getByLabel('Limite inferior da glicemia (mg/dL)'),
            ).toBeVisible()
          }),
      )
      await t.test('an unrelated patient cannot open the clinical data', () =>
        visit('otherPatient', async (page) => {
          await page.goto(
            `${config.review.origin}/profissional/pacientes/${account('patient').id}/cuidados`,
          )
          await expect(page.getByRole('alert')).toContainText(
            'Não foi possível confirmar',
            { timeout: 20000 },
          )
          await expect(
            page.getByRole('region', { name: 'Histórico clínico' }),
          ).toHaveCount(0)
        }),
      )
    } finally {
      await browser.close()
    }
  },
)
