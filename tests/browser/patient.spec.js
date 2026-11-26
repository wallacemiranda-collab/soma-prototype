import { test, expect } from './fixture.js'
import { dateBefore, localDate } from '../../src/lib/patientData.js'

test('login returns to the private screen originally requested', async ({
  page,
  ui,
}) => {
  await page.goto('/evolucao')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('E-mail', { exact: true }).fill(ui.identities[0].email)
  await page
    .getByLabel('Senha', { exact: true })
    .fill('Synthetic-password-123!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/evolucao$/)
  await expect(
    page.getByRole('heading', { name: 'Sua evolução', exact: true }),
  ).toBeVisible()
})

test('demo is explicit, shared across screens and cannot save personal records', async ({
  page,
  ui,
}) => {
  await page.goto('/registro')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByLabel('E-mail', { exact: true })).toBeEmpty()
  await expect(page.getByLabel('Senha', { exact: true })).toBeEmpty()
  await page.getByRole('button', { name: 'Explorar demonstração' }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByText('Demonstração · dados fictícios')).toBeVisible()
  await page.getByRole('button', { name: /^Alimentação Registrar/ }).click()
  await page.getByRole('link', { name: 'Hábitos', exact: true }).click()
  await expect(
    page.getByRole('button', { name: /^Alimentação Registrar/ }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('link', { name: 'Início', exact: true }).click()
  await page
    .getByRole('link', { name: 'Registrar medidas', exact: true })
    .click()
  await expect(page.getByLabel('Data de nascimento (opcional)')).toHaveCount(0)
  await expect(page.getByLabel('Sexo (opcional)')).toHaveCount(0)
  await page.getByLabel('Peso (kg)', { exact: true }).fill('81.7')
  await page.getByRole('button', { name: 'Atualizar registro' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Registro fictício salvo',
  )
  await page.reload()
  await expect(page.getByLabel('Peso (kg)', { exact: true })).toHaveValue(
    '81.7',
  )
  await page.getByRole('link', { name: 'Perfil', exact: true }).first().click()
  await expect(
    page.getByRole('button', { name: 'Salvar perfil' }),
  ).toBeEnabled()
  await expect(page.getByLabel('Data de nascimento (opcional)')).toBeDisabled()
  await expect(page.getByLabel('Sexo (opcional)')).toBeDisabled()
  expect(ui.requests).toEqual([])
})

test('demo reload and direct URLs preserve the fictitious session and logout clears it', async ({
  page,
  ui,
}) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Explorar demonstração' }).click()
  await page.getByRole('button', { name: /^Alimentação Registrar/ }).click()
  for (const path of ['/educacao', '/evolucao', '/habitos', '/perfil']) {
    await page.goto(path)
    await expect(page.getByText('Demonstração · dados fictícios')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await page.reload()
    await expect(page.getByText('Demonstração · dados fictícios')).toBeVisible()
  }
  await page.goto('/habitos')
  await expect(
    page.getByRole('button', { name: /^Alimentação Registrar/ }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page
    .getByRole('button', { name: 'Ir para o login', exact: true })
    .click()
  await page.goto('/educacao')
  await expect(page).toHaveURL(/\/login$/)
  expect(
    await page.evaluate(() => sessionStorage.getItem('endo-demo-v1')),
  ).toBeNull()
  await ui.login()
  await expect(page.getByText('Demonstração · dados fictícios')).toHaveCount(0)
  expect(ui.data().entries).toEqual([])
})

test('patient calculator tab includes FINDRISC and clearly separated external tools', async ({
  page,
  ui,
}) => {
  await ui.login()
  await expect(page.getByRole('link', { name: 'Cálculos', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Cálculos', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Calculadoras', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'FINDRISC', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Calcular FINDRISC', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Abrir calculadora oficial PREVENT (AHA)' }))
    .toHaveAttribute('href', 'https://professional.heart.org/en/guidelines-and-statements/prevent-calculator')
  await expect(page.getByRole('link', { name: 'Abrir calculadora oficial FRAX' }))
    .toHaveAttribute('href', 'https://www.fraxplus.org/pt/calculation-tool/')
  await expect(page.getByRole('link', { name: 'Conhecer o modelo e suas limitações' }))
    .toHaveAttribute('href', 'https://glp1regainrisk.com/about')
  await expect(page.getByText('não destinada ao uso pelo paciente nem a decisões clínicas'))
    .toBeVisible()
  await expect(page.getByText('STOP-Bang', { exact: true })).toBeVisible()
  await expect(page.getByText('Escala de Sonolência de Epworth', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Abrir ferramenta oficial do STOP-Bang' }))
    .toHaveAttribute('href', 'https://www.stopbang.ca/')
  await expect(page.getByRole('link', { name: 'Acessar o site oficial da Epworth' }))
    .toHaveAttribute('href', 'https://epworthsleepinessscale.com/')
  for (const label of ['SARC-F', 'PHQ-9', 'GAD-7', 'AUDIT-C'])
    await expect(page.getByText(label, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Abrir calculadora de pesquisa da Mayo Clinic' }))
    .toHaveCount(0)
})

test('daily measures save, survive reload and update the same row', async ({
  page,
  ui,
}) => {
  await ui.login()
  await expect(page.getByText('Sem registro', { exact: true })).toHaveCount(2)
  await ui.record()
  await page.getByLabel('Peso (kg)', { exact: true }).fill('82.4')
  await page.getByLabel('Sono (horas)', { exact: true }).fill('7.57')
  await page.getByLabel('Movimento (minutos)', { exact: true }).fill('0')
  await page.getByLabel('Água (litros)', { exact: true }).fill('1.8')
  await page
    .getByRole('button', { name: 'Salvar registro', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('Registro salvo')
  expect(ui.data().entries[0]).toMatchObject({
    sleep_minutes: 454,
    activity_minutes: 0,
    waist_cm: null,
  })
  await page.reload()
  await expect(page.getByLabel('Peso (kg)', { exact: true })).toHaveValue(
    '82.4',
  )
  await page.getByLabel('Peso (kg)', { exact: true }).fill('83')
  await page.getByLabel('Água (litros)', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Atualizar registro' }).click()
  await expect(page.getByRole('status')).toContainText('Registro salvo')
  expect(ui.data().entries).toHaveLength(1)
  expect(ui.data().entries[0]).toMatchObject({
    weight_kg: 83,
    water_liters: null,
    sleep_minutes: 454,
  })
  await page.getByRole('link', { name: 'Evolução', exact: true }).click()
  await expect(page.getByText('83 kg', { exact: true }).first()).toBeVisible()
  await page.getByRole('link', { name: 'Editar registro' }).click()
  await expect(page.getByLabel('Peso (kg)', { exact: true })).toHaveValue('83')
})

test('blank, negative and future measurements are not submitted', async ({
  page,
  ui,
}) => {
  await ui.login()
  await ui.record()
  await page.getByRole('button', { name: 'Salvar registro' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Preencha pelo menos um registro',
  )
  await page.getByLabel('Peso (kg)', { exact: true }).fill('-1')
  await page.getByRole('button', { name: 'Salvar registro' }).click()
  expect(
    await page
      .getByLabel('Peso (kg)', { exact: true })
      .evaluate((input) => input.validity.rangeUnderflow),
  ).toBe(true)
  await page.getByLabel('Peso (kg)', { exact: true }).fill('80')
  await page.getByLabel('Data', { exact: true }).fill(dateBefore(-1))
  await page.getByRole('button', { name: 'Salvar registro' }).click()
  expect(
    await page
      .getByLabel('Data', { exact: true })
      .evaluate((input) => input.validity.rangeOverflow),
  ).toBe(true)
  expect(
    ui.requests.filter(
      (request) =>
        request.table === 'metabolic_entries' && request.method === 'POST',
    ),
  ).toEqual([])
})

test('daily form contains measures only and never overwrites personal details', async ({
  page,
  ui,
}) => {
  Object.assign(ui.data().profile, {
    birth_date: '1992-02-29',
    sex: 'female',
    goal_weight: 75,
  })
  await ui.login()
  await ui.record()
  await expect(page.getByLabel('Data de nascimento (opcional)')).toHaveCount(0)
  await expect(page.getByLabel('Sexo (opcional)')).toHaveCount(0)
  await page.getByLabel('Peso (kg)', { exact: true }).fill('82.4')
  await page.getByRole('button', { name: 'Salvar registro' }).click()
  await expect(page.getByRole('status')).toContainText('Registro salvo')
  expect(
    ui.requests.filter((r) => r.table === 'profiles' && r.method !== 'GET'),
  ).toEqual([])
  expect(ui.data().profile).toMatchObject({
    birth_date: '1992-02-29',
    sex: 'female',
    goal_weight: 75,
  })
  await page.getByRole('link', { name: 'Perfil', exact: true }).first().click()
  await expect(page.getByLabel('Data de nascimento (opcional)')).toHaveValue(
    '1992-02-29',
  )
  await expect(page.getByLabel('Sexo (opcional)')).toHaveValue('female')
})

test('personal details are validated and saved only in Profile', async ({
  page,
  ui,
}) => {
  await ui.login()
  await page.getByRole('link', { name: 'Perfil', exact: true }).click()
  await page.getByLabel('Data de nascimento (opcional)').fill(dateBefore(-1))
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  expect(
    await page
      .getByLabel('Data de nascimento (opcional)')
      .evaluate((input) => input.validity.rangeOverflow),
  ).toBe(true)
  expect(
    ui.requests.filter((r) => r.table === 'profiles' && r.method === 'POST'),
  ).toEqual([])
  await page.getByLabel('Data de nascimento (opcional)').fill('1992-02-29')
  await page.getByLabel('Sexo (opcional)').selectOption('intersex')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByRole('status')).toContainText('Perfil atualizado')
  await page.reload()
  await expect(page.getByLabel('Sexo (opcional)')).toHaveValue('intersex')
  await page.getByLabel('Data de nascimento (opcional)').fill('')
  await page.getByLabel('Sexo (opcional)').selectOption('')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByRole('status')).toContainText('Perfil atualizado')
  expect(ui.data().profile.birth_date).toBeNull()
  expect(ui.data().profile.sex).toBeNull()
})

test('failed profile saves preserve input and never create measures', async ({
  page,
  ui,
}) => {
  await ui.login()
  await page.getByRole('link', { name: 'Perfil', exact: true }).click()
  await page.getByLabel('Data de nascimento (opcional)').fill('1990-07-15')
  await page.getByLabel('Sexo (opcional)').selectOption('female')
  ui.failNext('profiles')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByLabel('Data de nascimento (opcional)')).toHaveValue(
    '1990-07-15',
  )
  expect(ui.data().profile.birth_date).toBeNull()
  expect(ui.data().entries).toHaveLength(0)
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByRole('status')).toContainText('Perfil atualizado')
  expect(ui.data().profile.sex).toBe('female')
})

test('automatic sleep and movement are date-scoped and do not erase manual habits', async ({
  page,
  ui,
}) => {
  await ui.login()
  await page.getByRole('link', { name: 'Hábitos', exact: true }).click()
  await page.getByRole('button', { name: /^Movimento Registrar/ }).click()
  await ui.record()
  await page.getByLabel('Sono (horas)', { exact: true }).fill('6')
  await page.getByLabel('Movimento (minutos)', { exact: true }).fill('20')
  await page.getByRole('button', { name: 'Salvar registro' }).click()
  await expect(page.getByRole('status')).toContainText('Registro salvo')
  await page.getByRole('link', { name: 'Hábitos', exact: true }).click()
  for (const label of [/^Rotina de sono Registrado/, /^Movimento Registrado/]) {
    await expect(page.getByRole('button', { name: label })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('button', { name: label })).toBeDisabled()
  }
  await page.getByLabel('Dia do registro', { exact: true }).fill(dateBefore(1))
  await expect(
    page.getByRole('button', { name: /^Rotina de sono Registrar/ }),
  ).toHaveAttribute('aria-pressed', 'false')
  await ui.record()
  await page.getByLabel('Sono (horas)', { exact: true }).fill('0')
  await page.getByLabel('Movimento (minutos)', { exact: true }).fill('0')
  await page.getByRole('button', { name: 'Atualizar registro' }).click()
  await expect(page.getByRole('status')).toContainText('Registro salvo')
  await page.getByRole('link', { name: 'Hábitos', exact: true }).click()
  await expect(
    page.getByRole('button', { name: /^Rotina de sono Registrar/ }),
  ).toHaveAttribute('aria-pressed', 'false')
  await expect(
    page.getByRole('button', { name: /^Movimento Registrar/ }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(ui.data().logs).toHaveLength(1)
})

test('record dates remain separate and edits restore the selected day', async ({
  page,
  ui,
}) => {
  await ui.login()
  await ui.record()
  await page.getByLabel('Peso (kg)', { exact: true }).fill('80')
  await page.getByRole('button', { name: 'Salvar registro' }).click()
  await expect(page.getByRole('status')).toContainText('Registro salvo')
  await page.getByLabel('Data', { exact: true }).fill(dateBefore(1))
  await expect(page.getByLabel('Peso (kg)', { exact: true })).toHaveValue('')
  await page.getByLabel('Peso (kg)', { exact: true }).fill('81')
  await page.getByRole('button', { name: 'Salvar registro' }).click()
  await expect(page.getByRole('status')).toContainText('Registro salvo')
  expect(ui.data().entries).toHaveLength(2)
  await page.getByLabel('Data', { exact: true }).fill(localDate())
  await expect(page.getByLabel('Peso (kg)', { exact: true })).toHaveValue('80')
})

test('save failure preserves entered values and retry produces no duplicate', async ({
  page,
  ui,
}) => {
  await ui.login()
  await ui.record()
  ui.failNext('metabolic_entries')
  await page.getByLabel('Peso (kg)', { exact: true }).fill('80')
  await page.getByRole('button', { name: 'Salvar registro' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByLabel('Peso (kg)', { exact: true })).toHaveValue('80')
  expect(ui.data().entries).toHaveLength(0)
  await page.getByRole('button', { name: 'Salvar registro' }).click()
  await expect(page.getByRole('status')).toContainText('Registro salvo')
  expect(ui.data().entries).toHaveLength(1)
})

test('habits persist by date and failed writes are not shown as completed', async ({
  page,
  ui,
}) => {
  await ui.login()
  await page.getByRole('link', { name: 'Hábitos', exact: true }).click()
  const sleep = page.getByRole('button', { name: /^Rotina de sono Registrar/ })
  ui.failNext('habit_logs')
  await sleep.click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(sleep).toHaveAttribute('aria-pressed', 'false')
  await sleep.click()
  await expect(sleep).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(sleep).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Dia do registro', { exact: true }).fill(dateBefore(1))
  await expect(sleep).toHaveAttribute('aria-pressed', 'false')
  await sleep.click()
  await expect(sleep).toHaveAttribute('aria-pressed', 'true')
  await sleep.click()
  await expect(sleep).toHaveAttribute('aria-pressed', 'false')
  expect(ui.data().logs).toHaveLength(2)
  await page.getByRole('link', { name: 'Início', exact: true }).click()
  await expect(sleep).toHaveAttribute('aria-pressed', 'true')
})

test('profile edits persist and are cleared when another account signs in', async ({
  page,
  ui,
}) => {
  await ui.login()
  await ui.record()
  await page.getByLabel('Peso (kg)', { exact: true }).fill('80')
  await page.getByRole('button', { name: 'Salvar registro' }).click()
  await expect(page.getByRole('status')).toContainText('Registro salvo')
  await page.getByRole('link', { name: 'Perfil', exact: true }).click()
  await page.getByLabel('Nome completo', { exact: true }).fill('Beatriz teste')
  await page.getByLabel('Data de nascimento (opcional)').fill('1990-07-15')
  await page.getByLabel('Sexo (opcional)').selectOption('female')
  await page
    .getByLabel('Meta pessoal de peso (kg, opcional)', { exact: true })
    .fill('75')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByRole('status')).toContainText('Perfil atualizado')
  await page.reload()
  await expect(page.getByLabel('Nome completo', { exact: true })).toHaveValue(
    'Beatriz teste',
  )
  await expect(
    page.getByLabel('Meta pessoal de peso (kg, opcional)', { exact: true }),
  ).toHaveValue('75')
  await expect(page.getByLabel('Data de nascimento (opcional)')).toHaveValue(
    '1990-07-15',
  )
  await expect(page.getByLabel('Sexo (opcional)')).toHaveValue('female')
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/evolucao')
  await expect(page).toHaveURL(/\/login$/)
  await ui.login(1)
  await expect(page.getByText('Sem registro', { exact: true })).toHaveCount(2)
  await expect(page.getByText('Beatriz teste', { exact: true })).toHaveCount(0)
  expect(ui.data().entries).toHaveLength(0)
  await page.getByRole('link', { name: 'Perfil', exact: true }).click()
  await expect(page.getByLabel('Data de nascimento (opcional)')).toHaveValue('')
  await expect(page.getByLabel('Sexo (opcional)')).toHaveValue('')
})

test('data load failures can be retried and still allow logout', async ({
  page,
  ui,
}) => {
  await ui.login()
  ui.blockReads('metabolic_entries')
  await page.reload()
  await expect(page.getByRole('alert')).toContainText(
    'Não foi possível carregar',
  )
  await expect(
    page.getByRole('button', { name: 'Sair da conta' }),
  ).toBeEnabled()
  ui.allowReads('metabolic_entries')
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(
    page.getByRole('heading', { name: 'Ana!', exact: true }),
  ).toBeVisible()
})

test('signup waits for email confirmation and invalid recovery links fail closed', async ({
  page,
  ui,
}) => {
  await page.goto('/login?modo=cadastro')
  await page
    .getByLabel('Nome completo', { exact: true })
    .fill('Cadastro sintético')
  await page
    .getByLabel('E-mail', { exact: true })
    .fill('signup@example.invalid')
  await page
    .getByLabel('Senha', { exact: true })
    .fill('Synthetic-password-123!')
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Confira seu e-mail')
  await page.goto('/home')
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/redefinir-senha')
  await expect(
    page.getByText('Este link expirou ou não é válido.'),
  ).toBeVisible()
  expect(ui.requests).toEqual([])
})

test('password recovery requires matching passwords before sending an update', async ({
  page,
  ui,
}) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click()
  await page.getByLabel('E-mail', { exact: true }).fill('ana@example.invalid')
  await page.getByRole('button', { name: 'Enviar link' }).click()
  await expect(page.getByRole('status')).toContainText('Se houver uma conta')
  const session = ui.session()
  await page.goto(
    `/redefinir-senha#access_token=${session.access_token}&refresh_token=${session.refresh_token}&expires_in=3600&token_type=bearer&type=recovery`,
  )
  await page
    .getByLabel('Nova senha', { exact: true })
    .fill('Synthetic-password-456!')
  await page
    .getByLabel('Confirme a senha', { exact: true })
    .fill('Different-password-456!')
  await page.getByRole('button', { name: 'Salvar senha' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'As senhas precisam ser iguais',
  )
  await page
    .getByLabel('Confirme a senha', { exact: true })
    .fill('Synthetic-password-456!')
  await page.getByRole('button', { name: 'Salvar senha' }).click()
  await expect(
    page.getByRole('heading', { name: 'Ana!', exact: true }),
  ).toBeVisible()
})

test('mobile navigation fits a narrow screen and education links have real destinations', async ({
  page,
  ui,
}) => {
  await ui.login()
  await page.setViewportSize({ width: 320, height: 800 })
  for (const name of ['Início', 'Evolução', 'Hábitos', 'Educação', 'Perfil']) {
    await page
      .getByRole('navigation')
      .getByRole('link', { name, exact: true })
      .click()
    await expect(page.getByRole('navigation')).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  }
  await page.getByRole('link', { name: 'Educação', exact: true }).click()
  await expect(
    page.getByRole('link', { name: 'Acessar canal' }),
  ).toHaveAttribute('href', 'https://www.youtube.com/@WallaceMiranda')
})
