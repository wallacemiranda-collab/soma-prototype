import { test, expect } from './fixture.js'
import { dateBefore, localDate } from '../../src/lib/patientData.js'

test('height in Profile persists and creates dated BMI and waist/height only on saved measures', async ({
  page,
  ui,
}, testInfo) => {
  await ui.login()
  await page.getByRole('link', { name: 'Perfil', exact: true }).click()
  await page.getByLabel('Altura (cm, opcional)').fill('175')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByRole('status')).toContainText('Perfil atualizado')
  await page.reload()
  await expect(page.getByLabel('Altura (cm, opcional)')).toHaveValue('175')
  await ui.record()
  await expect(page.getByText(/Altura de referência: 175 cm/)).toBeVisible()
  await page.getByLabel('Peso (kg)', { exact: true }).fill('70')
  await page.getByLabel('Cintura (cm)', { exact: true }).fill('100')
  await page.getByRole('button', { name: 'Salvar registro' }).click()
  await expect(page.getByRole('status')).toContainText('Registro salvo')
  expect(ui.data().entries[0].height_cm).toBe(175)
  await page.getByRole('link', { name: 'Evolução', exact: true }).click()
  const derived = page.getByRole('region', { name: 'Medidas derivadas' })
  await expect(derived.getByText('22,9 kg/m²', { exact: true })).toBeVisible()
  await expect(derived.getByText('0,57', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('img', { name: 'Cintura registrada, em centímetros' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Perfil', exact: true }).click()
  await page.getByLabel('Altura (cm, opcional)').fill('180')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByRole('status')).toContainText('Perfil atualizado')
  expect(ui.data().entries[0].height_cm).toBe(175)
  await page.getByRole('link', { name: 'Evolução', exact: true }).click()
  await expect(derived.getByText('22,9 kg/m²', { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 320, height: 800 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('phase1-evolution.png'),
    fullPage: true,
  })
})

test('backdated records do not acquire current profile height and old references are preserved', async ({
  page,
  ui,
}) => {
  ui.data().profile.height_cm = 180
  ui.data().entries.push({
    id: 'legacy',
    entry_date: dateBefore(1),
    weight_kg: 70,
    waist_cm: 96.5,
    height_cm: null,
  })
  await ui.login()
  await page.goto('/evolucao')
  await expect(
    page
      .getByRole('region', { name: 'Medidas derivadas' })
      .getByText('Sem cálculo', { exact: true }),
  ).toHaveCount(2)
  await page.getByRole('link', { name: 'Editar registro' }).click()
  await expect(
    page.getByText(/Altura de referência: Sem registro/),
  ).toBeVisible()
  await page.getByLabel('Peso (kg)', { exact: true }).fill('71')
  await page.getByRole('button', { name: 'Atualizar registro' }).click()
  await expect(page.getByRole('status')).toContainText('Registro salvo')
  expect(ui.data().entries[0].height_cm).toBeNull()
  ui.data().entries[0].height_cm = 170
  await page.reload()
  await page.getByLabel('Peso (kg)', { exact: true }).fill('72')
  await page.getByRole('button', { name: 'Atualizar registro' }).click()
  await expect(page.getByRole('status')).toContainText('Registro salvo')
  expect(ui.data().entries[0].height_cm).toBe(170)
})

test('invalid or failed height updates preserve the existing profile and entered value', async ({
  page,
  ui,
}) => {
  ui.data().profile.height_cm = 170
  await ui.login()
  await page.getByRole('link', { name: 'Perfil', exact: true }).click()
  await page.getByLabel('Altura (cm, opcional)').fill('0')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  expect(ui.data().profile.height_cm).toBe(170)
  await page.getByLabel('Altura (cm, opcional)').fill('175')
  ui.failNext('profiles')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByLabel('Altura (cm, opcional)')).toHaveValue('175')
  expect(ui.data().profile.height_cm).toBe(170)
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByRole('status')).toContainText('Perfil atualizado')
  await page.getByLabel('Altura (cm, opcional)').fill('')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByRole('status')).toContainText('Perfil atualizado')
  expect(ui.data().profile.height_cm).toBeNull()
})

test('demo height and measures can be explored across reloads without any backend writes', async ({
  page,
  ui,
}) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Explorar demonstração' }).click()
  await page.goto('/perfil')
  await expect(page.getByLabel('Nome completo', { exact: true })).toBeDisabled()
  await expect(page.getByLabel('Data de nascimento (opcional)')).toBeDisabled()
  await page.getByLabel('Altura (cm, opcional)').fill('175')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Altura fictícia atualizada',
  )
  await page.reload()
  await expect(page.getByLabel('Altura (cm, opcional)')).toHaveValue('175')
  await page.goto('/registro')
  await page.getByLabel('Peso (kg)', { exact: true }).fill('70')
  await page.getByLabel('Cintura (cm)', { exact: true }).fill('100')
  await page.getByRole('button', { name: 'Atualizar registro' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Registro fictício salvo',
  )
  await page.goto('/evolucao')
  await expect(page.getByText('22,9 kg/m²', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('22,9 kg/m²', { exact: true })).toBeVisible()
  expect(ui.requests).toEqual([])
  expect(ui.data().entries).toEqual([])
  const raw = await page.evaluate(() => sessionStorage.getItem('endo-demo-v1'))
  expect(
    JSON.parse(raw).data.entries.find((e) => e.entry_date === localDate())
      .height_cm,
  ).toBe(175)
  await page
    .getByRole('button', { name: 'Ir para o login', exact: true })
    .click()
  await ui.login()
  expect(ui.data().profile.height_cm ?? null).toBeNull()
  await expect(page.getByText('Demonstração · dados fictícios')).toHaveCount(0)
})
