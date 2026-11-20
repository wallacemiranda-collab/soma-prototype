import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'

const base = new URL(
  process.env.ENDO_PUBLIC_URL || 'https://endo-plus.vercel.app',
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
    }
    await page
      .getByRole('link', { name: 'Registrar medidas', exact: true })
      .click()
    await expect(page.getByRole('button', { name: /registro$/ })).toBeDisabled()
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
