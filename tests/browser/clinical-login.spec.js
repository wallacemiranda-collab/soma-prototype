import { test, expect } from './fixture'

test('phase 3 is absent by default and does not register a worker or manifest for real accounts', async ({
  page,
  ui,
}) => {
  const workers = []
  page.on('request', (request) => {
    if (request.url().includes('/phase3-sw.js')) workers.push(request.url())
  })
  await ui.login()
  await expect(
    page.getByRole('link', { name: /Experimentar lembretes/ }),
  ).toHaveCount(0)
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0)
  expect(
    await page.evaluate(() =>
      navigator.serviceWorker.getRegistrations().then((rows) => rows.length),
    ),
  ).toBe(0)
  expect(workers).toEqual([])
})

test('patient login returns to the clinical workspace requested by a direct link', async ({
  page,
  ui,
}) => {
  await page.goto('/cuidados')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('E-mail', { exact: true }).fill(ui.identities[0].email)
  await page.getByLabel('Senha', { exact: true }).fill('synthetic-password')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/cuidados$/)
})

test('professional login preserves the patient clinical route and professional entry', async ({
  page,
  ui,
}) => {
  const patient = ui.identities[0].id
  const doctor = ui.identities[1].id
  ui.accounts.get(doctor).doctorProfile = {
    user_id: doctor,
    professional_name: 'Bruno teste',
    profession: 'Medicina',
    council: 'CRM',
    crm: '12345',
    crm_state: 'SP',
    share_code: 'DOCTOR123',
  }
  const target = `/profissional/pacientes/${patient}/cuidados`
  await page.goto(target)
  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByRole('button', {
      name: 'Sou profissional de saúde',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('E-mail', { exact: true }).fill(ui.identities[1].email)
  await page.getByLabel('Senha', { exact: true }).fill('synthetic-password')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${target}$`))
})
