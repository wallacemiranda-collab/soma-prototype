function validatedAnswers(values, count, maxValue, label) {
  if (!Array.isArray(values) || values.length !== count)
    throw new Error(`Informe todas as respostas do ${label}.`)
  if (!values.every((value) => Number.isInteger(value) && value >= 0 && value <= maxValue))
    throw new Error(`Cada resposta do ${label} deve estar entre 0 e ${maxValue}.`)
  return values
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0)
}

export function phq9Band(score) {
  if (!Number.isInteger(score) || score < 0 || score > 27) return null
  if (score <= 4) return 'Mínimo'
  if (score <= 9) return 'Leve'
  if (score <= 14) return 'Moderado'
  if (score <= 19) return 'Moderadamente grave'
  return 'Grave'
}

export function calculatePhq9(answers) {
  const values = validatedAnswers(answers, 9, 3, 'PHQ-9')
  const score = sum(values)
  return {
    score,
    maxScore: 27,
    band: phq9Band(score),
    item9Positive: values[8] > 0,
  }
}

export function gad7Band(score) {
  if (!Number.isInteger(score) || score < 0 || score > 21) return null
  if (score <= 4) return 'Mínimo'
  if (score <= 9) return 'Leve'
  if (score <= 14) return 'Moderado'
  return 'Grave'
}

export function calculateGad7(answers) {
  const values = validatedAnswers(answers, 7, 3, 'GAD-7')
  const score = sum(values)
  return { score, maxScore: 21, band: gad7Band(score) }
}

export function calculateAuditC(itemScores) {
  const values = validatedAnswers(itemScores, 3, 4, 'AUDIT-C')
  return { score: sum(values), maxScore: 12 }
}
