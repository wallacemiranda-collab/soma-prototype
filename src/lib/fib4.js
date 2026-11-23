export const fib4Bounds = {
  age: { min: 18, max: 120 },
  ast: { min: 1, max: 1000 },
  alt: { min: 1, max: 1000 },
  platelets: { min: 10, max: 1000 },
}

export const fib4References = [
  {
    label: 'Sterling et al., Hepatology, 2006',
    url: 'https://doi.org/10.1002/hep.21178',
  },
  {
    label: 'AASLD Practice Guidance, 2023',
    url: 'https://doi.org/10.1097/HEP.0000000000000323',
  },
]

function numberInRange(value, bounds, label, integer = false) {
  if (typeof value === 'string' && value.trim() === '')
    throw new Error(`Informe ${label}.`)
  const number = Number(value)
  if (
    !Number.isFinite(number) ||
    number < bounds.min ||
    number > bounds.max ||
    (integer && !Number.isInteger(number))
  )
    throw new Error(`${label} fora do intervalo permitido.`)
  return number
}

function validDate(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error('Informe a data do exame.')
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value ||
    parsed > new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  )
    throw new Error('A data do exame é inválida ou futura.')
  return value
}

export function validateFib4Inputs(values, { now = new Date() } = {}) {
  return {
    age_years: numberInRange(values.age_years, fib4Bounds.age, 'idade', true),
    ast_u_l: numberInRange(values.ast_u_l, fib4Bounds.ast, 'AST'),
    alt_u_l: numberInRange(values.alt_u_l, fib4Bounds.alt, 'ALT'),
    platelets_10e9_l: numberInRange(
      values.platelets_10e9_l,
      fib4Bounds.platelets,
      'plaquetas',
    ),
    test_date: validDate(values.test_date, now),
  }
}

export function ageAtDate(birthDate, date) {
  if (
    typeof birthDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  )
    return null
  const birth = new Date(`${birthDate}T00:00:00.000Z`)
  const at = new Date(`${date}T00:00:00.000Z`)
  if (
    Number.isNaN(birth.getTime()) ||
    Number.isNaN(at.getTime()) ||
    birth.toISOString().slice(0, 10) !== birthDate ||
    at.toISOString().slice(0, 10) !== date ||
    birth > at
  )
    return null
  return (
    at.getUTCFullYear() -
    birth.getUTCFullYear() -
    (at.getUTCMonth() < birth.getUTCMonth() ||
    (at.getUTCMonth() === birth.getUTCMonth() &&
      at.getUTCDate() < birth.getUTCDate())
      ? 1
      : 0)
  )
}

export function calculateFib4(values, options = {}) {
  const inputs = validateFib4Inputs(values, options)
  const score =
    (inputs.age_years * inputs.ast_u_l) /
    (inputs.platelets_10e9_l * Math.sqrt(inputs.alt_u_l))
  const lowCutoff = inputs.age_years >= 65 ? 2 : 1.3
  const category =
    inputs.age_years < 35
      ? 'age_limited'
      : score < lowCutoff
        ? 'low'
        : score <= 2.67
          ? 'intermediate'
          : 'high'

  return {
    score: Number(score.toFixed(2)),
    category,
    low_cutoff: lowCutoff,
    high_cutoff: 2.67,
    age_limited: inputs.age_years < 35,
  }
}

export function fib4Interpretation(result) {
  if (result.category === 'age_limited')
    return 'A interpretação do FIB-4 é menos confiável abaixo de 35 anos.'
  if (result.category === 'low')
    return `Abaixo do ponto de corte de ${result.low_cutoff}; não confirma nem exclui diagnóstico.`
  if (result.category === 'intermediate')
    return 'Faixa intermediária; o resultado precisa ser interpretado no contexto clínico.'
  return 'Acima de 2,67; requer interpretação clínica e não confirma diagnóstico.'
}
