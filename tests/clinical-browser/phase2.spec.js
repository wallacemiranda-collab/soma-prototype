import { test, expect } from '../browser/fixture'

async function demo(page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Explorar demonstração' }).click()
  await page.getByRole('link', { name: /Conhecer os módulos clínicos/ }).click()
}
async function grant(page, name = 'Médica A · fictícia') {
  await page
    .getByRole('checkbox', {
      name: new RegExp(`Autorizo ${name.replace('·', '.')}`),
    })
    .check()
  await page
    .getByRole('button', { name: `Autorizar ativação de ${name}`, exact: true })
    .click()
}
async function doctor(page) {
  await page
    .getByRole('link', { name: 'Simular perspectiva do médico' })
    .click()
}

test('separate permission, module ownership, revocation and renewal cannot silently reactivate modules', async ({
  page,
}) => {
  await demo(page)
  await expect(
    page.getByRole('heading', { name: 'Nenhum módulo ativo' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: 'Autorizar ativação de Médica A · fictícia',
      exact: true,
    }),
  ).toBeDisabled()
  await doctor(page)
  await expect(
    page.getByRole('button', { name: 'Ativar Tireoide', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('link', { name: 'Voltar à perspectiva do paciente' })
    .click()
  await grant(page)
  await grant(page, 'Médico B · fictício')
  await doctor(page)
  await page
    .getByRole('button', { name: 'Ativar Tireoide', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Salvar configuração de Tireoide' }),
  ).toBeEnabled()
  await page
    .getByLabel('Médico fictício em simulação')
    .selectOption('demo-doctor-b')
  await expect(
    page.getByRole('button', { name: 'Ativar Tireoide', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('link', { name: 'Voltar à perspectiva do paciente' })
    .click()
  await page.getByRole('link', { name: 'Abrir Tireoide', exact: true }).click()
  await page
    .getByRole('button', { name: 'Adicionar exemplos fictícios de Tireoide' })
    .click()
  await expect(
    page.getByRole('region', { name: 'Histórico clínico fictício' }),
  ).toContainText('Tomada de levotiroxina')
  await page.goto('/modulos')
  await page
    .getByRole('button', { name: 'Revogar ativação de Médica A · fictícia' })
    .click()
  await page.goto('/modulos/thyroid')
  await expect(page.getByText(/Módulo inativo. Novas anotações/)).toBeVisible()
  await expect(page.locator('form')).toHaveCount(0)
  await expect(
    page.getByRole('region', { name: 'Histórico clínico fictício' }),
  ).toContainText('Tomada de levotiroxina')
  await page.goto('/modulos')
  await grant(page)
  await expect(
    page.getByRole('link', { name: 'Abrir Tireoide', exact: true }),
  ).toHaveCount(0)
  await doctor(page)
  await page
    .getByRole('button', { name: 'Salvar configuração de Tireoide' })
    .click()
  await page.goto('/modulos/thyroid')
  await expect(page.locator('form')).toHaveCount(1)
})

test('diabetes tracks all contexts, HbA1c and reported episodes with sample percentages and direct URL persistence', async ({
  page,
  ui,
}) => {
  await demo(page)
  await grant(page)
  await doctor(page)
  await page.getByLabel('Limite inferior da glicemia (mg/dL)').fill('80')
  await page.getByLabel('Limite superior da glicemia (mg/dL)').fill('180')
  await page
    .getByRole('button', { name: 'Ativar Diabetes', exact: true })
    .click()
  await page.goto('/modulos/diabetes')
  await page
    .getByRole('button', { name: 'Adicionar exemplos fictícios de Diabetes' })
    .click()
  await expect(
    page.getByText('75% das medições na faixa (3 de 4)', { exact: true }),
  ).toBeVisible()
  await page
    .getByLabel('Filtrar contexto das glicemias')
    .selectOption('fasting')
  await expect(
    page.getByText('100% das medições na faixa (2 de 2)', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Histórico clínico fictício' }),
  ).toContainText('HbA1c')
  await page.getByLabel('Glicemia (mg/dL)', { exact: true }).fill('130')
  await page
    .getByRole('combobox', { name: 'Contexto', exact: true })
    .selectOption('bedtime')
  await page.getByRole('button', { name: 'Salvar glicemia capilar' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Registro fictício salvo',
  )
  await page.reload()
  await expect(
    page.getByRole('region', { name: 'Histórico clínico fictício' }),
  ).toContainText('Antes de dormir')
  await page.goto('/evolucao')
  await expect(
    page.getByRole('region', { name: 'Evolução clínica fictícia' }),
  ).toContainText('Glicemias por contexto')
  await page.goto('/modulos/diabetes')
  await page.getByLabel('O que deseja registrar?').selectOption('hypoglycemia')
  await page.getByLabel('Sintomas percebidos').fill('Exemplo fictício')
  await page.getByLabel('O que você fez').fill('Exemplo de anotação')
  await page
    .getByRole('button', { name: 'Salvar episódio de hipoglicemia informado' })
    .click()
  await expect(page.getByRole('status')).toContainText(
    'Registro fictício salvo',
  )
  await page.setViewportSize({ width: 320, height: 800 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  expect(
    ui.requests.filter((row) => ['POST', 'PATCH'].includes(row.method)),
  ).toHaveLength(0)
})

test('GLP-1 records versioned dose snapshots, calendar predictions and five symptom intensities', async ({
  page,
}) => {
  await demo(page)
  await grant(page)
  await doctor(page)
  await page
    .getByRole('combobox', { name: 'Medicamento fictício', exact: true })
    .selectOption('Semaglutida')
  await page.getByLabel('Dose fictícia (mg)', { exact: true }).fill('1')
  await page.getByLabel('Intervalo prescrito fictício (dias)').fill('7')
  await page
    .getByLabel('Primeira aplicação prevista deste esquema')
    .fill('2026-01-01')
  await page
    .getByRole('button', { name: 'Ativar GLP-1 e tirzepatida', exact: true })
    .click()
  await page.goto('/modulos/glp1')
  await page
    .getByRole('button', {
      name: 'Adicionar exemplos fictícios de GLP-1 e tirzepatida',
    })
    .click()
  await page.getByLabel('Local da aplicação').selectOption('thigh')
  await page
    .getByRole('button', { name: 'Salvar aplicação realizada', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText(
    'Registro fictício salvo',
  )
  await page.getByLabel('O que deseja registrar?').selectOption('gi')
  await page
    .getByRole('combobox', { name: 'Náusea', exact: true })
    .selectOption('3')
  await page
    .getByRole('button', { name: 'Salvar sintomas gastrointestinais' })
    .click()
  await expect(
    page.getByRole('region', { name: 'Histórico clínico fictício' }),
  ).toContainText('3 · Intenso')
  await page.goto('/previa/medico')
  await page.getByLabel('Dose fictícia (mg)', { exact: true }).fill('2')
  await page
    .getByRole('button', { name: 'Salvar configuração de GLP-1 e tirzepatida' })
    .click()
  await page.goto('/modulos/glp1')
  await expect(
    page.getByRole('region', { name: 'Histórico clínico fictício' }),
  ).toContainText('1 mg · versão 1')
  await expect(page.getByText(/Semaglutida · 2 mg · intervalo/)).toBeVisible()
})

test('thyroid and blood pressure accept dated records; physician history has no record editing controls', async ({
  page,
}) => {
  await demo(page)
  await grant(page)
  await doctor(page)
  await page
    .getByRole('button', { name: 'Ativar Tireoide', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Ativar Pressão arterial', exact: true })
    .click()
  await page.goto('/modulos/thyroid')
  await page.getByLabel('Estava em jejum?').selectOption('unsure')
  await page
    .getByRole('button', { name: 'Salvar tomada de levotiroxina' })
    .click()
  await expect(
    page.getByRole('region', { name: 'Histórico clínico fictício' }),
  ).toContainText('Não sei informar')
  await page.goto('/modulos/pressure')
  await page.getByLabel('Sistólica (mmHg)', { exact: true }).fill('120')
  await page.getByLabel('Diastólica (mmHg)', { exact: true }).fill('80')
  await page.getByRole('button', { name: 'Salvar pressão arterial' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Registro fictício salvo',
  )
  await page.goto('/previa/medico')
  await expect(
    page.getByRole('region', { name: 'Histórico clínico fictício' }),
  ).toContainText('Pressão arterial')
  await expect(
    page
      .getByRole('region', { name: 'Histórico clínico fictício' })
      .locator('input,button'),
  ).toHaveCount(0)
})

test('real accounts cannot open clinical preview or use its cached permissions as authorization', async ({
  page,
  ui,
}) => {
  await ui.login()
  await expect(
    page.getByRole('link', { name: /Conhecer os módulos clínicos/ }),
  ).toHaveCount(0)
  await page.evaluate(() =>
    sessionStorage.setItem(
      'endo-clinical-preview-v1',
      JSON.stringify({
        version: 1,
        mode: 'clinical-demo',
        data: {
          permissions: { 'demo-doctor-a': { allowed: true, epoch: 1 } },
          modules: {},
          records: [],
        },
      }),
    ),
  )
  await page.goto('/previa/medico')
  await expect(
    page.getByRole('heading', { name: 'Prévia indisponível' }),
  ).toBeVisible()
  await expect(page.locator('form')).toHaveCount(0)
  await expect(page.getByLabel('Médico fictício em simulação')).toHaveCount(0)
})

test('logout clears clinical records and permissions before a new demonstration starts', async ({
  page,
}) => {
  await demo(page)
  await grant(page)
  await doctor(page)
  await page
    .getByRole('button', { name: 'Ativar Tireoide', exact: true })
    .click()
  await page.goto('/modulos/thyroid')
  await page
    .getByRole('button', { name: 'Adicionar exemplos fictícios de Tireoide' })
    .click()
  await page
    .getByRole('button', { name: 'Ir para o login', exact: true })
    .click()
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem('endo-clinical-preview-v1'),
    ),
  ).toBeNull()
  await page.getByRole('button', { name: 'Explorar demonstração' }).click()
  await page.goto('/modulos')
  await expect(
    page.getByRole('heading', { name: 'Nenhum módulo ativo' }),
  ).toBeVisible()
})
