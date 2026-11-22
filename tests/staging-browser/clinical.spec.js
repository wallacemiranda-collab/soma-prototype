import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { dateBefore } from '../../src/lib/patientData.js'
import {
  loadStagingConfig,
  confirmStagingBackend,
} from '../staging/support.mjs'

const config = loadStagingConfig()
const account = (role) => config.accounts.find((value) => value.role === role)
const patient = account('otherPatient')
const doctor = account('otherDoctor')
const forbidden = []
const errors = []

test.describe.configure({ mode: 'serial' })
test.beforeAll(async () => {
  const client = createClient(config.url, config.publishable_key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  await confirmStagingBackend(client)
})
test.beforeEach(async ({ page }) => {
  forbidden.length = 0
  errors.length = 0
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    const unknownBackend =
      url.hostname.endsWith('.supabase.co') && url.origin !== config.url
    const productionSite =
      url.hostname.endsWith('.vercel.app') ||
      url.hostname === 'endoplus.vercel.app'
    const sendsMail =
      /^\/auth\/v1\/(signup|recover|otp|invite|resend|magiclink)(\/|$)/.test(
        url.pathname,
      )
    if (unknownBackend || productionSite || sendsMail) {
      forbidden.push(url.pathname)
      return route.abort()
    }
    return route.continue()
  })
})
test.afterEach(async ({ page }) => {
  // Revoke this browser's synthetic session before its context is discarded.
  if (page.url().startsWith('http://127.0.0.1:4178')) {
    await page.evaluate(
      async ({ url, key }) => {
        const saved = localStorage.getItem('sb-ctcsolobseerqnddahun-auth-token')
        const token = saved && JSON.parse(saved).access_token
        if (token)
          await fetch(`${url}/auth/v1/logout`, {
            method: 'POST',
            headers: { apikey: key, Authorization: `Bearer ${token}` },
          })
      },
      { url: config.url, key: config.publishable_key },
    )
  }
  expect(forbidden, 'No production requests or outgoing emails').toEqual([])
  expect(errors, 'No uncaught browser errors').toEqual([])
})
async function login(page, identity, professional = false) {
  await page.goto(`/login?acesso=${professional ? 'profissional' : 'paciente'}`)
  await page.getByLabel('E-mail', { exact: true }).fill(identity.email)
  // Keep generated passwords out of Playwright action logs and recordings.
  await page
    .getByLabel('Senha', { exact: true })
    .evaluate((input, password) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      ).set
      setter.call(input, password)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }, identity.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(professional ? /\/profissional$/ : /\/home$/)
}

test('a real patient login saves a clinical record and preserves it after reload at mobile width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await login(page, patient)
  await page.goto('/cuidados')
  await page.getByLabel('Glicemia (mg/dL)', { exact: true }).fill('127')
  await page
    .getByLabel('Data e hora', { exact: true })
    .fill(`${dateBefore(1)}T10:00`)
  await page
    .getByRole('button', { name: 'Salvar glicemia capilar', exact: true })
    .click()
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Registro salvo no seu histórico.' }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('region', { name: 'Histórico clínico' }),
  ).toContainText('127')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem('endo-clinical-preview-v1'),
    ),
  ).toBeNull()
  await page
    .getByRole('button', { name: 'Corrigir registro', exact: true })
    .click()
  const editor = page.getByRole('form', { name: 'Corrigir registro clínico' })
  await editor.getByLabel('Glicemia (mg/dL)', { exact: true }).fill('129')
  await editor
    .getByLabel('Motivo da correção')
    .fill('Digitei o número errado no teste')
  await editor
    .getByRole('button', { name: 'Salvar correção', exact: true })
    .click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Correção salva.' }),
  ).toBeVisible()
  await page.reload()
  const history = page.getByRole('region', { name: 'Histórico clínico' })
  await expect(history.locator('article')).toHaveCount(1)
  await expect(history).toContainText('129')
  await history
    .getByText('Ver original e alterações (1)', { exact: true })
    .click()
  await expect(history).toContainText('127')
  await expect(history).toContainText('Digitei o número errado no teste')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('a physician sees authorized history and persists a new plan without editing patient observations', async ({
  page,
}) => {
  await login(page, doctor, true)
  await page.goto(`/profissional/pacientes/${patient.id}/cuidados`)
  await expect(
    page.getByRole('region', { name: 'Histórico clínico' }),
  ).toContainText('129')
  await page.getByLabel('Limite inferior da glicemia (mg/dL)').fill('85')
  const response = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname ===
        '/rest/v1/rpc/endo_configure_clinical_module' &&
      res.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: 'Atualizar Diabetes', exact: true })
    .click()
  expect((await response).status()).toBe(200)
  await expect(
    page.getByRole('button', { name: 'Atualizar Diabetes', exact: true }),
  ).toBeEnabled()
  await page.reload()
  await expect(
    page.getByLabel('Limite inferior da glicemia (mg/dL)'),
  ).toHaveValue('85')
  await expect(
    page
      .getByRole('region', { name: 'Histórico clínico' })
      .locator('button,input'),
  ).toHaveCount(0)
})

test('a different patient cannot open another patient clinical workspace', async ({
  page,
}) => {
  await login(page, patient)
  await page.goto(`/profissional/pacientes/${account('patient').id}/cuidados`)
  await expect(page.getByRole('alert')).toContainText(
    'Não foi possível confirmar',
  )
  await expect(
    page.getByRole('region', { name: 'Histórico clínico' }),
  ).toHaveCount(0)
  await expect(
    page.getByLabel('Limite inferior da glicemia (mg/dL)'),
  ).toHaveCount(0)
})

test('a patient voids a corrected observation with confirmation and retains the full audit history', async ({
  page,
}) => {
  await login(page, patient)
  await page.goto('/cuidados')
  await page
    .getByRole('button', { name: 'Desconsiderar registro', exact: true })
    .click()
  const form = page.getByRole('form', {
    name: 'Desconsiderar registro clínico',
  })
  await form
    .getByLabel('Motivo para desconsiderar')
    .fill('Duplicação fictícia para testar histórico')
  await expect(
    form.getByRole('button', { name: 'Confirmar registro desconsiderado' }),
  ).toBeDisabled()
  await form.getByRole('checkbox').check()
  await form
    .getByRole('button', { name: 'Confirmar registro desconsiderado' })
    .click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Registro desconsiderado.' }),
  ).toBeVisible()
  await page.reload()
  const history = page.getByRole('region', { name: 'Histórico clínico' })
  await expect(history).toContainText('Desconsiderado · não entra nos resumos')
  await history
    .getByText('Ver original e alterações (2)', { exact: true })
    .click()
  await expect(history).toContainText('127')
  await expect(history).toContainText('129')
  await expect(history).toContainText('Duplicação fictícia')
})
