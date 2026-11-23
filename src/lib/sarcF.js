export const sarcFReferences = [
  {
    title: 'Validação brasileira do SARC-F',
    url: 'https://pubmed.ncbi.nlm.nih.gov/27650212/',
  },
  {
    title: 'ABRASSO: interpretação do SARC-F',
    url: 'https://www.scielo.br/j/adr/a/CSCWcWrTvLcpzP3bcXrhgDb/',
  },
  {
    title: 'Versão brasileira do questionário (5 kg)',
    url: 'https://repositorio.ufpi.br/xmlui/bitstream/handle/123456789/2069/Disserta%C3%A7%C3%A3o_Rutielle_Ferreira_Silva.pdf?sequence=1',
  },
]

const answerKeys = ['strength', 'walking', 'chair', 'stairs', 'falls']

function answerValue(value, label) {
  if (value === 0 || value === '0') return 0
  if (value === 1 || value === '1') return 1
  if (value === 2 || value === '2') return 2
  throw new Error(`Responda: ${label}.`)
}

export function calculateSarcF(answers) {
  const labels = {
    strength: 'dificuldade para levantar e carregar 5 kg',
    walking: 'dificuldade para atravessar um cômodo',
    chair: 'dificuldade para levantar de uma cama ou cadeira',
    stairs: 'dificuldade para subir 10 degraus',
    falls: 'número de quedas no último ano',
  }
  const points = Object.fromEntries(
    answerKeys.map((key) => [key, answerValue(answers?.[key], labels[key])]),
  )
  const score = Object.values(points).reduce((total, value) => total + value, 0)

  return {
    score,
    maxScore: 10,
    suggestive: score >= 4,
    points,
  }
}
