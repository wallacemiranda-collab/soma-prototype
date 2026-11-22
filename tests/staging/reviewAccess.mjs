import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadStagingConfig } from './support.mjs'

export function loadReviewAccess() {
  const config = loadStagingConfig()
  const url = new URL(config.review?.url)
  if (
    url.protocol !== 'https:' ||
    !/^soma-prototype-nc87-[a-z0-9]+-wallace-miranda-s-projects\.vercel\.app$/.test(
      url.hostname,
    ) ||
    url.pathname !== '/login' ||
    !/^[A-Za-z0-9_-]{12,200}$/.test(
      url.searchParams.get('_vercel_share') || '',
    ) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error('Refuse an unknown or production review URL.')
  return {
    ...config,
    review: { ...config.review, origin: url.origin, url: url.href },
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const path = process.env.ENDO_STAGING_CONFIG
  if (!path) throw new Error('A private staging configuration is required.')
  const config = loadStagingConfig(path)
  config.review = JSON.parse(process.env.ENDO_REVIEW_DETAILS)
  // Generated access data stays outside the repository, never in the deployed source.
  writeFileSync(path, JSON.stringify(config), { mode: 0o600 })
  const checked = loadReviewAccess()
  const roles = [
    ['patient', 'PACIENTE FICTÍCIO'],
    ['doctor', 'MÉDICO FICTÍCIO'],
    ['nutritionist', 'NUTRICIONISTA FICTÍCIA (SOMENTE LEITURA)'],
  ]
  const text = [
    'ENDO + | ACESSOS TEMPORÁRIOS PARA REVISÃO',
    'Use apenas dados fictícios. Não use sua conta real. Não encaminhe estes acessos a pacientes.',
    '',
    'LINK PROTEGIDO:',
    checked.review.url,
    `Validade solicitada do link: até ${new Date(checked.review.expiresAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Brasília).`,
    '',
    ...roles.flatMap(([role, label]) => {
      const a = checked.accounts.find((a) => a.role === role)
      return [label, `E-mail: ${a.email}`, `Senha: ${a.password}`, '']
    }),
    'COMO REVISAR',
    '1. Entre como paciente e abra Meus acompanhamentos clínicos na tela inicial.',
    '2. Teste registros, correção com motivo, histórico original e desconsideração confirmada.',
    '3. Confira Evolução, Hábitos, Educação, Perfil e Equipe de saúde.',
    '4. Saia em Perfil antes de entrar como médico, ou use outra janela anônima.',
    '5. Escolha Sou profissional de saúde e abra o paciente fictício autorizado.',
    '6. Confira a configuração dos módulos e o histórico sem edição de registros.',
    '',
    'Teste em iPhone/Safari e Android/Chrome. Informe aparelho, navegador e o que aconteceu se houver problema.',
    'Todos os nomes, medidas, registros profissionais e esquemas deste ambiente são fictícios. Não representam uma prescrição.',
    'As contas fictícias ficam disponíveis para esta revisão e devem ser removidas após seu encerramento.',
  ].join('\n')
  const output = resolve(dirname(path), 'ACESSOS_ENDO_REVISAO.txt')
  writeFileSync(output, text, { mode: 0o600 })
  console.log(JSON.stringify({ accessFile: output, syntheticOnly: true }))
}
