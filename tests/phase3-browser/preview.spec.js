import { test, expect } from '@playwright/test'
import { isPhase3PreviewHost } from '../../src/lib/phase3Preview.js'

const key = 'endo-reminders-preview-v1'
const remote = process.env.ENDO_PHASE3_URL
if (remote) {
  const url = new URL(remote)
  if (url.protocol !== 'https:' || !isPhase3PreviewHost(url.hostname))
    throw new Error('Refuse an official or unknown test destination')
}

test.beforeEach(async ({ context, page }) => {
  const errors = [],
    backend = []
  page.on('pageerror', (error) => errors.push(error.message))
  context.on('request', (request) => {
    if (
      /\.supabase\.co$|^endo-tests\.invalid$/.test(
        new URL(request.url()).hostname,
      )
    )
      backend.push(request.url())
  })
  await context.route(
    /https:\/\/[^/]*(?:supabase\.co|endo-tests\.invalid)\//,
    (route) => route.abort(),
  )
  await context.addInitScript(() => {
    window.__notificationRequests = 0
    if ('Notification' in window)
      Object.defineProperty(Notification, 'requestPermission', {
        configurable: true,
        value: () => {
          window.__notificationRequests++
          throw new Error('Real notifications forbidden')
        },
      })
    if ('PushManager' in window)
      Object.defineProperty(PushManager.prototype, 'subscribe', {
        configurable: true,
        value: () => {
          window.__notificationRequests++
          throw new Error('Real push forbidden')
        },
      })
  })
  page.__previewChecks = { errors, backend }
  if (remote) await page.goto(remote)
})
test.afterEach(async ({ page }) => {
  expect(page.__previewChecks.errors).toEqual([])
  expect(page.__previewChecks.backend).toEqual([])
  expect(await page.evaluate(() => window.__notificationRequests || 0)).toBe(0)
})
async function demo(page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Explorar demonstração' }).click()
  await page.getByRole('link', { name: /Experimentar lembretes/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Meus lembretes', exact: true }),
  ).toBeVisible()
}

test('preview has no real login and provides install instructions, manifest and correctly sized icons', async ({
  page,
  context,
}) => {
  await page.goto('/login')
  await expect(
    page.getByRole('complementary', { name: 'Prévia da Fase 3' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Entrar', exact: true }),
  ).toBeDisabled()
  await expect(page).toHaveTitle(/Prévia Fase 3/)
  await page.goto('/instalar')
  await expect(
    page.getByRole('heading', { name: 'iPhone ou iPad' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Android', exact: true }),
  ).toBeVisible()
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  )
  const manifest = await (
    await context.request.get('/manifest.webmanifest')
  ).json()
  expect(manifest.display).toBe('standalone')
  expect(manifest.start_url).toBe('/instalar')
  for (const size of [180, 192, 512]) {
    const icon = await context.request.get(`/icons/endo-preview-${size}.png`)
    expect(icon.status()).toBe(200)
    const png = await icon.body()
    expect(png.readUInt32BE(16)).toBe(size)
    expect(png.readUInt32BE(20)).toBe(size)
  }
  await page.setViewportSize({ width: 320, height: 780 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('settings survive reload and quiet hours suppress without postponing reminders', async ({
  page,
}) => {
  await demo(page)
  await page
    .getByLabel('Ativar simulação de lembretes', { exact: true })
    .check()
  await page.getByLabel('Medicação (exemplo)', { exact: true }).check()
  await page
    .getByLabel('Horário: Medicação (exemplo)', { exact: true })
    .fill('23:00')
  await page.getByLabel('Horário fictício para o teste').fill('23:00')
  await page
    .getByRole('button', { name: 'Simular horário', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('Período de silêncio')
  await page.getByLabel('Horário fictício para o teste').fill('08:00')
  await page
    .getByRole('button', { name: 'Simular horário', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText(
    'Nenhum lembrete selecionado',
  )
  await page
    .getByLabel('Horário: Medicação (exemplo)', { exact: true })
    .fill('08:00')
  await page
    .getByRole('button', { name: 'Simular horário', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText(
    'não é uma notificação real',
  )
  await page
    .getByRole('button', { name: 'Salvar simulação', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('somente nesta aba')
  await page.goto('/lembretes')
  await expect(
    page.getByLabel('Ativar simulação de lembretes', { exact: true }),
  ).toBeChecked()
  await expect(
    page.getByLabel('Horário: Medicação (exemplo)', { exact: true }),
  ).toHaveValue('08:00')
  await expect(
    page.getByRole('complementary', { name: 'Prévia da Fase 3' }),
  ).toBeVisible()
})

test('weekly day is respected and one-touch stop works with an invalid unsaved form', async ({
  page,
}) => {
  await demo(page)
  await page
    .getByLabel('Ativar simulação de lembretes', { exact: true })
    .check()
  await page.getByLabel('Aplicação semanal (exemplo)', { exact: true }).check()
  await page.getByLabel('Horário fictício para o teste').fill('09:00')
  await page.getByLabel('Dia da semana para o teste').selectOption('2')
  await page
    .getByRole('button', { name: 'Simular horário', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText(
    'Nenhum lembrete selecionado',
  )
  await page.getByLabel('Dia da semana para o teste').selectOption('1')
  await page
    .getByRole('button', { name: 'Simular horário', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText(
    'Aplicação semanal (exemplo)',
  )
  await page
    .getByRole('button', { name: 'Salvar simulação', exact: true })
    .click()
  await page.getByLabel('Silêncio termina').fill('22:00')
  await page
    .getByRole('button', { name: 'Salvar simulação', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('devem ser diferentes')
  await page
    .getByRole('button', { name: 'Desligar todos os lembretes' })
    .click()
  await expect(
    page.getByLabel('Ativar simulação de lembretes', { exact: true }),
  ).not.toBeChecked()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByLabel('Aplicação semanal (exemplo)', { exact: true }),
  ).not.toBeChecked()
  await expect(
    page.getByLabel('Ativar simulação de lembretes', { exact: true }),
  ).not.toBeChecked()
})

test('logout clears preferences and a new demonstration starts disabled', async ({
  page,
}) => {
  await demo(page)
  await page
    .getByLabel('Ativar simulação de lembretes', { exact: true })
    .check()
  await page
    .getByRole('button', { name: 'Salvar simulação', exact: true })
    .click()
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), key),
  ).not.toBeNull()
  await page.getByRole('link', { name: 'Perfil', exact: true }).first().click()
  await page
    .getByRole('button', { name: 'Sair da demonstração', exact: true })
    .click()
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), key),
  ).toBeNull()
  await page.goto('/lembretes')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('button', { name: 'Explorar demonstração' }).click()
  await page.getByRole('link', { name: /Experimentar lembretes/ }).click()
  await expect(
    page.getByLabel('Ativar simulação de lembretes', { exact: true }),
  ).not.toBeChecked()
})

test('blocked storage stays explicitly in memory without requesting notification permission', async ({
  context,
  page,
}) => {
  await context.addInitScript(() =>
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('Storage blocked by test')
      },
    }),
  )
  await demo(page)
  await page
    .getByLabel('Ativar simulação de lembretes', { exact: true })
    .check()
  await page
    .getByRole('button', { name: 'Salvar simulação', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('somente em memória')
  await page
    .getByRole('button', { name: 'Desligar todos os lembretes' })
    .click()
  await expect(
    page.getByLabel('Ativar simulação de lembretes', { exact: true }),
  ).not.toBeChecked()
})

test('dismissed install prompt is single-use and never claims installation succeeded', async ({
  page,
}) => {
  await page.goto('/instalar')
  await page.evaluate(() => {
    window.__installPrompts = 0
    const event = new Event('beforeinstallprompt', { cancelable: true })
    Object.assign(event, {
      prompt: async () => {
        window.__installPrompts++
      },
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    })
    dispatchEvent(event)
  })
  await page
    .getByRole('button', { name: 'Instalar prévia', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText(
    'Instalação não concluída',
  )
  expect(await page.evaluate(() => window.__installPrompts)).toBe(1)
  await expect(
    page.getByText('Esta prévia já está aberta como aplicativo.'),
  ).toHaveCount(0)
})

test('offline displays only a generic reconnect page, with no cached health screens', async ({
  page,
  context,
}) => {
  await demo(page)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true)
  expect(await page.evaluate(() => caches.keys())).toEqual([])
  await context.setOffline(true)
  try {
    const response = await page.goto('/lembretes')
    expect(response.fromServiceWorker()).toBe(true)
    expect(response.status()).toBe(503)
    await expect(
      page.getByRole('heading', { name: 'Você está sem conexão' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Meus lembretes', exact: true }),
    ).toHaveCount(0)
  } finally {
    await context.setOffline(false)
  }
})
