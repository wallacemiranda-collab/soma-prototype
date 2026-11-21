import { test, expect } from '../browser/fixture'
import { randomUUID } from 'node:crypto'

async function clinicalBackend(page, ui, options = {}) {
  const patient = ui.identities[0].id
  const doctor = ui.identities[1].id
  const calls = []
  const version = {
    id: randomUUID(),
    setting_id: randomUUID(),
    patient_id: patient,
    module_key: 'diabetes',
    doctor_id: doctor,
    revision: 1,
    glucose_low: 80,
    glucose_high: 180,
    created_at: new Date().toISOString(),
  }
  const module = {
    id: version.setting_id,
    patient_id: patient,
    module_key: 'diabetes',
    doctor_id: doctor,
    permission_id: randomUUID(),
    enabled: true,
    active: !options.inactive,
    current_version_id: version.id,
    version,
  }
  const permissions = options.noPermission
    ? []
    : [
        {
          id: module.permission_id,
          patient_id: patient,
          doctor_id: doctor,
          revoked_at: null,
        },
      ]
  const records = []
  let failWrite = options.failWrite
  let revoked = false
  ui.accounts.get(doctor).doctorProfile = {
    user_id: doctor,
    professional_name: 'Bruno médico',
    profession: 'Medicina',
    council: 'CRM',
    crm: '12345',
    crm_state: 'SP',
    share_code: 'DOCTOR123',
  }
  ui.shares.set(`${patient}:${doctor}`, {
    patient_id: patient,
    doctor_id: doctor,
    granted_at: new Date().toISOString(),
    expires_at: null,
    revoked_at: null,
  })
  await page.route('https://endo-tests.invalid/rest/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const name = url.pathname.split('/').at(-1)
    const headers = {
      'access-control-allow-origin': 'http://127.0.0.1:4174',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    }
    if (request.method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers })
    const reply = (json, status = 200) =>
      route.fulfill({ json, status, headers })
    if (name.startsWith('endo_') && name.includes('clinical')) {
      const values = request.postDataJSON()
      calls.push({ name, values })
      if (name === 'endo_clinical_overview')
        return revoked
          ? reply({ code: '42501', message: 'Revoked' }, 403)
          : reply({ modules: [module], permissions })
      if (name === 'endo_save_clinical_record') {
        if (failWrite) {
          failWrite = false
          return reply(
            { code: 'NETWORK_FAILURE', message: 'Falha de conexão simulada' },
            500,
          )
        }
        const existing = records.find(
          (row) => row.request_id === values.p_request_id,
        )
        if (existing) return reply(existing)
        const row = {
          ...values.p_values,
          id: randomUUID(),
          patient_id: patient,
          module_version_id: module.current_version_id,
          request_id: values.p_request_id,
        }
        records.push(row)
        return reply(row)
      }
      if (name === 'endo_grant_clinical_activation') {
        permissions.push({
          id: randomUUID(),
          doctor_id: doctor,
          patient_id: patient,
          revoked_at: null,
        })
        return reply(permissions.at(-1).id)
      }
      if (name === 'endo_revoke_clinical_activation') {
        permissions.forEach((p) => {
          p.revoked_at = new Date().toISOString()
        })
        module.active = false
        return reply(null)
      }
      if (name === 'endo_close_clinical_module') {
        module.enabled = false
        module.active = false
        return reply(null)
      }
      if (name === 'endo_configure_clinical_module') {
        if (options.noPermission)
          return reply({ code: '42501', message: 'Not authorized' }, 403)
        module.active = true
        module.enabled = true
        module.version = {
          ...version,
          id: randomUUID(),
          revision: 2,
          glucose_low: values.p_config.low,
          glucose_high: values.p_config.high,
        }
        module.current_version_id = module.version.id
        return reply(module.version)
      }
    }
    if (
      [
        'glucose_readings',
        'hypoglycemia_events',
        'hba1c_results',
        'injection_logs',
        'gi_symptom_logs',
        'thyroid_intakes',
        'blood_pressure_readings',
        'clinical_module_versions',
      ].includes(name)
    ) {
      return reply(
        name === 'clinical_module_versions'
          ? [
              version,
              ...(module.version.id === version.id ? [] : [module.version]),
            ]
          : name === 'glucose_readings'
            ? records
            : [],
      )
    }
    return route.fallback()
  })
  return {
    patient,
    doctor,
    calls,
    records,
    module,
    revoke() {
      revoked = true
      ui.shares.get(`${patient}:${doctor}`).revoked_at =
        new Date().toISOString()
    },
  }
}

test('patient integration saves an authenticated record, retries with the same identity and survives reload', async ({
  page,
  ui,
}) => {
  const api = await clinicalBackend(page, ui, { failWrite: true })
  await ui.login()
  await page
    .getByRole('link', { name: 'Meus acompanhamentos clínicos' })
    .click()
  await page.getByLabel('Glicemia (mg/dL)', { exact: true }).fill('120')
  await page
    .getByRole('button', { name: 'Salvar glicemia capilar', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    'Falha de conexão simulada',
  )
  await expect(
    page.getByLabel('Glicemia (mg/dL)', { exact: true }),
  ).toHaveValue('120')
  await page
    .getByRole('button', { name: 'Salvar glicemia capilar', exact: true })
    .click()
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Registro salvo no seu histórico.' }),
  ).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Histórico clínico' }),
  ).toContainText('120')
  const writes = api.calls.filter(
    (call) => call.name === 'endo_save_clinical_record',
  )
  expect(writes).toHaveLength(2)
  expect(writes[0].values.p_request_id).toBe(writes[1].values.p_request_id)
  expect(writes[1].values.p_actor_id).toBe(api.patient)
  expect(writes[1].values.p_values.patient_id).toBeUndefined()
  expect(api.records).toHaveLength(1)
  await page.reload()
  await expect(
    page.getByRole('region', { name: 'Histórico clínico' }),
  ).toContainText('120')
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem('endo-clinical-preview-v1'),
    ),
  ).toBeNull()
  await page.goto('/evolucao')
  await expect(
    page.getByRole('region', { name: 'Evolução clínica da conta' }),
  ).toContainText('120')
})

test('clinical activation consent is explicit and revocation removes forms without erasing history', async ({
  page,
  ui,
}) => {
  const api = await clinicalBackend(page, ui)
  await ui.login()
  await page.goto('/cuidados')
  await page.getByLabel('Glicemia (mg/dL)', { exact: true }).fill('140')
  await page
    .getByRole('button', { name: 'Salvar glicemia capilar', exact: true })
    .click()
  await expect(
    page.getByRole('region', { name: 'Histórico clínico' }),
  ).toContainText('140')
  await page
    .getByRole('button', { name: 'Revogar ativação de Bruno médico' })
    .click()
  await expect(
    page.getByRole('button', { name: 'Salvar glicemia capilar', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('region', { name: 'Histórico clínico' }),
  ).toContainText('140')
  await expect(
    page.getByRole('button', {
      name: 'Autorizar ativação de Bruno médico',
      exact: true,
    }),
  ).toBeDisabled()
  await page
    .getByRole('checkbox', { name: /^Autorizo Bruno médico a ativar/ })
    .check()
  await page
    .getByRole('button', {
      name: 'Autorizar ativação de Bruno médico',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('button', { name: 'Revogar ativação de Bruno médico' }),
  ).toBeVisible()
  expect(api.module.active).toBe(false)
})

test('physician configuration uses authorization and a version without editing patient records', async ({
  page,
  ui,
}) => {
  const api = await clinicalBackend(page, ui)
  await ui.login(1, 'doctor')
  await page.goto(`/profissional/pacientes/${api.patient}/cuidados`)
  await page.getByLabel('Limite inferior da glicemia (mg/dL)').fill('90')
  await page
    .getByRole('button', { name: 'Atualizar Diabetes', exact: true })
    .click()
  await expect
    .poll(
      () =>
        api.calls.filter(
          (call) => call.name === 'endo_configure_clinical_module',
        ).length,
    )
    .toBe(1)
  await expect(
    page.getByRole('button', { name: 'Atualizar Diabetes', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByLabel('Limite inferior da glicemia (mg/dL)'),
  ).toHaveValue('90')
  const request = api.calls.find(
    (call) => call.name === 'endo_configure_clinical_module',
  )
  expect(request.values.p_actor_id).toBe(api.doctor)
  expect(request.values.p_patient_id).toBe(api.patient)
  await expect(
    page
      .getByRole('region', { name: 'Histórico clínico' })
      .locator('button,input'),
  ).toHaveCount(0)
  api.revoke()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('alert')).toContainText('revogado')
  await expect(
    page.getByLabel('Limite inferior da glicemia (mg/dL)'),
  ).toHaveCount(0)
})

test('a physician without activation consent has disabled configuration controls', async ({
  page,
  ui,
}) => {
  const api = await clinicalBackend(page, ui, {
    noPermission: true,
    inactive: true,
  })
  await ui.login(1, 'doctor')
  await page.goto(`/profissional/pacientes/${api.patient}/cuidados`)
  await expect(
    page.getByRole('button', { name: 'Atualizar Diabetes', exact: true }),
  ).toBeDisabled()
  expect(
    api.calls.filter((call) => call.name === 'endo_configure_clinical_module'),
  ).toHaveLength(0)
})

test('demo cannot enter real integration routes or send clinical requests', async ({
  page,
  ui,
}) => {
  const api = await clinicalBackend(page, ui)
  await page.goto('/login')
  await page.getByRole('button', { name: 'Explorar demonstração' }).click()
  await expect(
    page.getByRole('link', { name: 'Meus acompanhamentos clínicos' }),
  ).toHaveCount(0)
  await page.goto('/cuidados')
  await expect(
    page.getByRole('heading', { name: 'Integração em preparação' }),
  ).toBeVisible()
  expect(api.calls).toHaveLength(0)
})
