import { after, afterEach, before, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import './domains.test.js'

const base = new URL(
  process.env.ENDO_PUBLIC_URL || 'https://endoplus.vercel.app',
).origin

describe('published Endo +', { timeout: 90000 }, () => {
  let browser
  let context
  let page
  const errors = []
  const writes = []

  before(async () => {
    browser = await chromium.launch({
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      headless: true,
      timeout: 20000,
    })
  })
  beforeEach(async () => {
    errors.length = 0
    writes.length = 0
    context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    })
    page = await context.newPage()
    page.setDefaultTimeout(10000)
    page.setDefaultNavigationTimeout(15000)
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('request', (request) => {
      if (request.url().includes('/rest/v1/') && request.method() !== 'GET')
        writes.push(request.url())
    })
  })
  afterEach(async () => {
    await context?.close()
  })
  after(async () => {
    await browser?.close()
  })

  test('pages load and private forms require a login', async () => {
    for (const path of [
      '/',
      '/login',
      '/registro',
      '/evolucao',
      '/habitos',
      '/educacao',
      '/perfil',
      '/compartilhar',
      '/medico',
      '/profissional',
      '/auth/callback',
      '/redefinir-senha',
    ]) {
      const response = await context.request.get(base + path)
      assert.equal(response.status(), 200, path)
      assert.ok((await response.text()).includes('<title>Endo +'), path)
    }
    await page.goto(base + '/registro')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByLabel('E-mail', { exact: true })).toBeEmpty()
    await expect(
      page.getByRole('button', { name: 'Entrar', exact: true }),
    ).toBeEnabled()
    await page.goto(base + '/medico')
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByRole('button', {
        name: 'Sou profissional de saúde',
        exact: true,
      }),
    ).toHaveAttribute('aria-pressed', 'true')
    await page.goto(base + '/profissional')
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByRole('button', {
        name: 'Sou profissional de saúde',
        exact: true,
      }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('demo navigation does not create accounts or save patient data', async () => {
    await page.goto(base + '/login')
    await page.getByRole('button', { name: 'Explorar demonstração' }).click()
    await expect(page.getByText('Demonstração · dados fictícios')).toBeVisible()
    for (const [name, path] of [
      ['Evolução', '/evolucao'],
      ['Hábitos', '/habitos'],
      ['Educação', '/educacao'],
      ['Perfil', '/perfil'],
      ['Início', '/home'],
    ]) {
      await page
        .getByRole('navigation')
        .getByRole('link', { name, exact: true })
        .click()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      if (path === '/perfil') {
        await expect(
          page.getByLabel('Data de nascimento (opcional)'),
        ).toBeDisabled()
        await expect(page.getByLabel('Sexo (opcional)')).toBeDisabled()
      }
    }
    await page
      .getByRole('link', { name: 'Registrar medidas', exact: true })
      .click()
    await expect(page.getByRole('button', { name: /registro$/ })).toBeEnabled()
    await expect(page.getByLabel('Data de nascimento (opcional)')).toHaveCount(
      0,
    )
    await expect(page.getByLabel('Sexo (opcional)')).toHaveCount(0)
    await page.setViewportSize({ width: 320, height: 800 })
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    )
    assert.deepEqual(writes, [])
    assert.deepEqual(errors, [])
  })

  test('landing exposes both entries and demo cannot authorize a doctor', async () => {
    await page.goto(base)
    await expect(
      page.getByRole('link', { name: /^Sou paciente/ }),
    ).toHaveAttribute('href', '/login?acesso=paciente')
    await expect(
      page.getByRole('link', { name: /^Sou profissional de saúde/ }),
    ).toHaveAttribute('href', '/login?acesso=profissional')
    await page.goto(base + '/login?acesso=paciente')
    await page.getByRole('button', { name: 'Explorar demonstração' }).click()
    await page.getByRole('link', { name: 'Evolução', exact: true }).click()
    await page.getByRole('link', { name: 'Compartilhar evolução' }).click()
    await expect(page.getByLabel('Código do profissional')).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Buscar profissional' }),
    ).toBeDisabled()
    assert.deepEqual(writes, [])
    assert.deepEqual(errors, [])
  })

  test('demo opens home after a protected form was requested', async () => {
    await page.goto(base + '/registro')
    await expect(page).toHaveURL(/\/login$/)
    await page.getByRole('button', { name: 'Explorar demonstração' }).click()
    await expect(page).toHaveURL(/\/home$/)
    await expect(
      page.getByRole('heading', { name: 'Paciente!', exact: true }),
    ).toBeVisible()
    assert.deepEqual(writes, [])
    assert.deepEqual(errors, [])
  })
})
