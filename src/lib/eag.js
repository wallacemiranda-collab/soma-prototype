export const eagReferences = [
  {
    title: 'Estudo ADAG: Nathan et al., 2008',
    url: 'https://pubmed.ncbi.nlm.nih.gov/18540046/',
  },
  {
    title: 'Calculadora de conversão da American Diabetes Association',
    url: 'https://professional.diabetes.org/glucose_calc',
  },
  {
    title: 'NIDDK: limitações do exame HbA1c',
    url: 'https://www.niddk.nih.gov/health-information/diagnostic-tests/a1c-test',
  },
]

function parseHbA1c(value) {
  const parsed =
    typeof value === 'string' ? Number(value.trim().replace(',', '.')) : value
  if (
    typeof parsed !== 'number' ||
    !Number.isFinite(parsed) ||
    parsed < 3 ||
    parsed > 20
  )
    throw new Error('Informe a HbA1c do exame entre 3% e 20%.')
  return parsed
}

export function calculateEagMgDl(hba1cPercent) {
  const hba1c = parseHbA1c(hba1cPercent)
  const estimate = 28.7 * hba1c - 46.7
  const roundingTolerance = Number.EPSILON * Math.max(1, Math.abs(estimate))
  return Math.round(estimate + roundingTolerance)
}
