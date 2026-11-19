import { test, expect } from '@playwright/test'

test('published pages load and personal routes require a login', async ({
  page,
  request,
}) => {
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
    const response = await request.get(path)
    expect(response.status(), path).toBe(200)
    expect(await response.text()).toContain('<title>Endo +')
  }
  await page.goto('/registro')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByLabel('E-mail', { exact: true })).toBeEmpty()
  await expect(
    page.getByRole('button', { name: 'Entrar', exact: true }),
  ).toBeEnabled()
})

test('published demo navigates without creating accounts or saving patient data', async ({
  page,
}) => {
  const errors = []
  const writes = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/') && request.method() !== 'GET')
      writes.push(request.url())
  })
  await page.goto('/login')
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
  expect(writes).toEqual([])
  expect(errors).toEqual([])
})

test('published demo starts at home even after requesting a private form', async ({
  page,
}) => {
  await page.goto('/registro')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('button', { name: 'Explorar demonstração' }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(
    page.getByRole('heading', { name: 'Paciente!', exact: true }),
  ).toBeVisible()
})
