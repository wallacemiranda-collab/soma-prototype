import { test, expect } from './fixture.js'
import { localDate } from '../../src/lib/patientData.js'

function seedDoctor(ui, index = 2, details = {}) {
  const profile = {
    user_id: ui.identities[index].id,
    professional_name: ui.identities[index].name,
    crm: '12345',
    crm_state: 'SP',
    share_code: index === 2 ? 'ABCDEF1234567890' : '1234567890ABCDEF',
    ...details,
  }
  ui.accounts.get(profile.user_id).doctorProfile = profile
  ui.codeReservations.set(profile.share_code, profile.user_id)
  return profile
}

test('doctor registers, patient authorizes, and the shared history is read-only', async ({
  page,
  ui,
}, testInfo) => {
  await page.goto('/')
  await page.getByRole('link', { name: /^Sou profissional de saúde/ }).click()
  await expect(
    page.getByRole('button', {
      name: 'Sou profissional de saúde',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true')
  await ui.login(2, 'doctor')
  await expect(
    page.getByRole('heading', { name: 'Cadastro profissional' }),
  ).toBeVisible()
  await page.getByLabel('Nome profissional').fill('Dra. Carla teste')
  await page.getByLabel('Registro profissional', { exact: true }).fill('12345')
  await page.getByLabel('UF do registro').selectOption('SP')
  await page.getByLabel(/^Declaro que sou profissional de saúde/).check()
  await page
    .getByRole('button', { name: 'Concluir cadastro profissional' })
    .click()
  await expect(page.getByLabel('Meu código profissional')).toHaveValue(
    'ABCDEF1234567890',
  )
  await expect(page.getByText(/Nenhum paciente autorizou/)).toBeVisible()
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await ui.login()
  await ui.record()
  await page.getByLabel('Peso (kg)', { exact: true }).fill('82.4')
  await page.getByRole('button', { name: 'Salvar registro' }).click()
  await expect(page.getByRole('status')).toContainText('Registro salvo')
  await page.getByRole('link', { name: 'Evolução', exact: true }).click()
  await page.getByRole('link', { name: 'Compartilhar evolução' }).click()
  await page.getByLabel('Código do profissional').fill('ABCDEF1234567890')
  await page.getByRole('button', { name: 'Buscar profissional' }).click()
  await expect(
    page.getByText('Dra. Carla teste', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Autorizar acesso' }),
  ).toBeDisabled()
  await page.getByLabel('Prazo de acesso').selectOption('7')
  await page.getByLabel(/^Autorizo este profissional/).check()
  await page.getByRole('button', { name: 'Autorizar acesso' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Autorização salva' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Perfil', exact: true }).click()
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await ui.login(2, 'doctor')
  await page.getByRole('link', { name: 'Ver evolução' }).click()
  await expect(
    page.getByRole('heading', { name: 'Ana teste', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('82,4 kg', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Editar registro' })).toHaveCount(
    0,
  )
  await expect(
    page.getByText(ui.identities[0].email, { exact: true }),
  ).toHaveCount(0)
  await page.setViewportSize({ width: 320, height: 800 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('doctor-patient.png'),
    fullPage: true,
  })
  ui.shares.get(`${ui.identities[0].id}:${ui.identities[2].id}`).revoked_at =
    new Date().toISOString()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('alert')).toContainText('Acesso encerrado')
  await expect(
    page.getByRole('heading', { name: 'Ana teste', exact: true }),
  ).toHaveCount(0)
})

test('doctor personalizes the code, keeps existing patients and is found by the new code', async ({
  page,
  ui,
}, testInfo) => {
  const doctor = seedDoctor(ui)
  const patientId = ui.identities[0].id
  ui.shares.set(`${patientId}:${doctor.user_id}`, {
    patient_id: patientId,
    doctor_id: doctor.user_id,
    granted_at: new Date().toISOString(),
    expires_at: null,
    revoked_at: null,
  })
  await ui.login(2, 'doctor')
  await expect(
    page.getByRole('heading', { name: 'Ana teste', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Meu código profissional').fill('Dr-Wallace')
  await expect(
    page.getByRole('button', { name: 'Copiar código' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Salvar código' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Código atualizado' }),
  ).toBeVisible()
  await expect(page.getByLabel('Meu código profissional')).toHaveValue(
    'DRWALLACE',
  )
  expect(ui.shares.size).toBe(1)
  await expect(
    page.getByRole('heading', { name: 'Ana teste', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Meu código profissional')).toHaveValue(
    'DRWALLACE',
  )
  await page.setViewportSize({ width: 320, height: 800 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('custom-doctor-code.png'),
    fullPage: true,
  })
  await page.getByRole('link', { name: 'Ver evolução' }).click()
  await expect(
    page.getByRole('heading', { name: 'Ana teste', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await ui.login()
  await page.goto('/compartilhar')
  await page.getByLabel('Código do profissional').fill(doctor.share_code)
  await page.getByRole('button', { name: 'Buscar profissional' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Nenhum profissional encontrado',
  )
  await page.getByLabel('Código do profissional').fill('dr wallace')
  await page.getByRole('button', { name: 'Buscar profissional' }).click()
  await expect(
    page.getByRole('button', { name: 'Autorizar acesso' }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('heading', { name: doctor.professional_name, exact: true })
      .first(),
  ).toBeVisible()
  expect(ui.shares.size).toBe(1)
})

test('code collisions and retired codes cannot be taken over by another doctor', async ({
  page,
  ui,
}) => {
  const first = seedDoctor(ui)
  const second = seedDoctor(ui, 3)
  await ui.login(2, 'doctor')
  await page.getByLabel('Meu código profissional').fill('abc')
  await page.getByRole('button', { name: 'Salvar código' }).click()
  await expect(page.getByRole('alert')).toContainText('6 a 24')
  expect(ui.requests.some((request) => request.method === 'PATCH')).toBe(false)
  await page.getByLabel('Meu código profissional').fill(second.share_code)
  await page.getByRole('button', { name: 'Salvar código' }).click()
  await expect(page.getByRole('alert')).toContainText('não está disponível')
  expect(ui.data().doctorProfile.share_code).toBe(first.share_code)
  await page.getByLabel('Meu código profissional').fill('DRWALLACE')
  await page.getByRole('button', { name: 'Salvar código' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Código atualizado' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await ui.login(3, 'doctor')
  await page.getByLabel('Meu código profissional').fill(first.share_code)
  await page.getByRole('button', { name: 'Salvar código' }).click()
  await expect(page.getByRole('alert')).toContainText('não está disponível')
  expect(ui.data().doctorProfile.share_code).toBe(second.share_code)
  await page.getByRole('button', { name: 'Cancelar alteração' }).click()
  await expect(page.getByLabel('Meu código profissional')).toHaveValue(
    second.share_code,
  )
  await expect(
    page.getByRole('button', { name: 'Salvar código' }),
  ).toBeDisabled()
})

test('failed code updates preserve the draft and can be retried safely', async ({
  page,
  ui,
}) => {
  const doctor = seedDoctor(ui)
  await ui.login(2, 'doctor')
  await page.getByLabel('Meu código profissional').fill('DRWALLACE')
  ui.failNext('doctor_profiles', 'PATCH')
  await page.getByRole('button', { name: 'Salvar código' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Não foi possível salvar o código',
  )
  await expect(page.getByLabel('Meu código profissional')).toHaveValue(
    'DRWALLACE',
  )
  expect(ui.data().doctorProfile.share_code).toBe(doctor.share_code)
  await expect(
    page.getByRole('button', { name: 'Copiar código' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Salvar código' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Código atualizado' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Copiar código' }),
  ).toBeEnabled()
  expect(
    ui.requests.filter(
      (request) =>
        ['metabolic_entries', 'habit_logs', 'profiles'].includes(
          request.table,
        ) && request.method !== 'GET',
    ),
  ).toEqual([])
})

test('patient may authorize two doctors and other professions, renew and revoke independently', async ({
  page,
  ui,
}, testInfo) => {
  const first = seedDoctor(ui)
  const second = seedDoctor(ui, 3)
  const nutritionist = seedDoctor(ui, 4, {
    profession: 'Nutrição',
    council: 'CRN',
    crm: '12345/N',
    share_code: 'NUTRITESTE',
  })
  const psychologist = seedDoctor(ui, 5, {
    profession: 'Psicologia',
    council: 'CRP',
    crm: '06/12345',
    share_code: 'PSITESTE',
  })
  await ui.login()
  await page.getByRole('link', { name: 'Perfil', exact: true }).click()
  await page.getByRole('link', { name: 'Minha equipe de saúde' }).click()
  for (const doctor of [first, second, nutritionist, psychologist, first]) {
    await page.getByLabel('Código do profissional').fill(doctor.share_code)
    await page.getByRole('button', { name: 'Buscar profissional' }).click()
    await page.getByLabel(/^Autorizo este profissional/).check()
    await page.getByRole('button', { name: 'Autorizar acesso' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Autorização salva' }),
    ).toBeVisible()
  }
  expect(ui.shares.size).toBe(4)
  await page.reload()
  const region = page.getByRole('region', { name: 'Meus compartilhamentos' })
  await expect(region.getByRole('heading', { level: 3 })).toHaveCount(4)
  await expect(
    region.getByText('Nutrição · CRN 12345/N/SP', { exact: true }),
  ).toBeVisible()
  await expect(
    region.getByText('Psicologia · CRP 06/12345/SP', { exact: true }),
  ).toBeVisible()
  await page.setViewportSize({ width: 320, height: 800 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('health-team.png'),
    fullPage: true,
  })
  const firstCard = page
    .getByRole('region', { name: 'Meus compartilhamentos' })
    .locator('section')
    .filter({
      has: page.getByRole('heading', {
        name: first.professional_name,
        exact: true,
      }),
    })
  await firstCard.getByRole('button', { name: 'Revogar acesso' }).click()
  await expect(page.getByRole('status')).toContainText('Acesso revogado')
  expect(
    ui.shares.get(`${ui.identities[0].id}:${first.user_id}`).revoked_at,
  ).not.toBeNull()
  expect(
    ui.shares.get(`${ui.identities[0].id}:${second.user_id}`).revoked_at,
  ).toBeNull()
  for (const professional of [nutritionist, psychologist]) {
    expect(
      ui.shares.get(`${ui.identities[0].id}:${professional.user_id}`)
        .revoked_at,
    ).toBeNull()
  }
  await page.getByRole('link', { name: 'Perfil', exact: true }).click()
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await ui.login(4, 'doctor')
  await page.getByRole('link', { name: 'Ver evolução' }).click()
  await expect(
    page.getByRole('heading', { name: 'Ana teste', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Editar registro' })).toHaveCount(
    0,
  )
})

test('nutritionist registers, personalizes a code and receives only patient-authorized access', async ({
  page,
  ui,
}, testInfo) => {
  await page.goto('/login?acesso=profissional')
  await expect(
    page.getByRole('button', {
      name: 'Sou profissional de saúde',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true')
  await ui.login(3, 'doctor')
  await page.getByLabel('Nome profissional').fill('Nutricionista teste')
  await page.getByLabel('Profissão', { exact: true }).fill('Nutrição')
  await page
    .getByLabel('Registro profissional', { exact: true })
    .fill('12345/N')
  await page.getByLabel('UF do registro').selectOption('SP')
  await page.getByLabel(/^Declaro que sou profissional de saúde/).check()
  await page
    .getByRole('button', { name: 'Concluir cadastro profissional' })
    .click()
  await expect(page.getByRole('alert')).toContainText('Para o CRM')
  expect(
    ui.requests.filter(
      (r) => r.table === 'doctor_profiles' && r.method === 'POST',
    ),
  ).toHaveLength(0)
  await page.getByLabel('Conselho ou órgão de registro').fill('crn')
  await page
    .getByRole('button', { name: 'Concluir cadastro profissional' })
    .click()
  await expect(page.getByText(/Nutrição · CRN 12345\/N\/SP/)).toBeVisible()
  await expect(page.getByText(/Nenhum paciente autorizou/)).toBeVisible()
  await page.getByLabel('Meu código profissional').fill('NUTRITESTE')
  await page.getByRole('button', { name: 'Salvar código' }).click()
  await expect(page.getByRole('status')).toContainText('Código atualizado')
  await page.reload()
  await expect(page.getByLabel('Meu código profissional')).toHaveValue(
    'NUTRITESTE',
  )
  await page.setViewportSize({ width: 320, height: 800 })
  await page.screenshot({
    path: testInfo.outputPath('nutritionist-code.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await ui.login()
  await page.goto('/compartilhar')
  await page.getByLabel('Código do profissional').fill('nutri teste')
  await page.getByRole('button', { name: 'Buscar profissional' }).click()
  await expect(
    page.getByText('Nutrição · CRN 12345/N/SP', { exact: true }),
  ).toBeVisible()
  expect(ui.shares.size).toBe(0)
  await expect(
    page.getByRole('button', { name: 'Autorizar acesso' }),
  ).toBeDisabled()
  await page.getByLabel(/^Autorizo este profissional/).check()
  await page.getByRole('button', { name: 'Autorizar acesso' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Autorização salva' }),
  ).toBeVisible()
  expect(ui.shares.size).toBe(1)
  expect(ui.accounts.get(ui.identities[3].id).doctorProfile).toMatchObject({
    profession: 'Nutrição',
    council: 'CRN',
    crm: '12345/N',
  })
})

test('unauthorized doctor cannot open a guessed patient URL or another patient list', async ({
  page,
  ui,
}) => {
  seedDoctor(ui)
  ui.accounts.get(ui.identities[0].id).entries.push({
    id: 'private-entry',
    entry_date: localDate(),
    weight_kg: 99,
  })
  await ui.login(2, 'doctor')
  await expect(page.getByText(/Nenhum paciente autorizou/)).toBeVisible()
  await page.goto(`/medico/pacientes/${ui.identities[0].id}`)
  await expect(page.getByRole('alert')).toContainText('autorização')
  await expect(page.getByText('99 kg', { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Ana teste', exact: true }),
  ).toHaveCount(0)
})

test('failed grants and revocations do not claim success', async ({
  page,
  ui,
}) => {
  const doctor = seedDoctor(ui)
  await ui.login()
  await page.goto('/compartilhar')
  await page.getByLabel('Código do profissional').fill(doctor.share_code)
  await page.getByRole('button', { name: 'Buscar profissional' }).click()
  await page.getByLabel(/^Autorizo este profissional/).check()
  ui.failNext('endo_grant_doctor_access')
  await page.getByRole('button', { name: 'Autorizar acesso' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Não foi possível autorizar',
  )
  expect(ui.shares.size).toBe(0)
  await page.getByRole('button', { name: 'Autorizar acesso' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Autorização salva' }),
  ).toBeVisible()
  ui.failNext('endo_revoke_doctor_access')
  await page.getByRole('button', { name: 'Revogar acesso' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Não foi possível revogar',
  )
  expect(
    ui.shares.get(`${ui.identities[0].id}:${doctor.user_id}`).revoked_at,
  ).toBeNull()
  await page.getByRole('button', { name: 'Revogar acesso' }).click()
  await expect(page.getByRole('status')).toContainText('Acesso revogado')
})

test('patient can review and edit history older than one year', async ({
  page,
  ui,
}) => {
  ui.data().entries.push({
    id: 'old-record',
    entry_date: '2020-01-15',
    weight_kg: 87,
    waist_cm: null,
    sleep_minutes: null,
    activity_minutes: null,
    water_liters: null,
    mood_score: null,
  })
  await ui.login()
  await page.getByRole('link', { name: 'Evolução', exact: true }).click()
  await expect(page.getByText('87 kg', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Todo o histórico' }).click()
  await expect(page.getByText('87 kg', { exact: true }).first()).toBeVisible()
  await page.getByRole('link', { name: 'Editar registro' }).click()
  await expect(page.getByLabel('Data', { exact: true })).toHaveValue(
    '2020-01-15',
  )
  await page.getByLabel('Peso (kg)', { exact: true }).fill('86')
  await page.getByRole('button', { name: 'Atualizar registro' }).click()
  await expect(page.getByRole('status')).toContainText('Registro salvo')
  expect(ui.data().entries).toHaveLength(1)
  expect(ui.data().entries[0].weight_kg).toBe(86)
})
