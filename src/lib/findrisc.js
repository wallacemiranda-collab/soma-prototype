export const findriscReferences = [
  {
    title: 'Ministério da Saúde: FINDRISC',
    url: 'https://linhasdecuidado.saude.gov.br/portal/diabetes-mellitus-tipo-2-%28DM2%29-no-adulto/unidade-de-atencao-primaria/dm2-cronica/questionario-finnish-diabetes-risk-score',
  },
  {
    title: 'Sociedade Brasileira de Diabetes: rastreamento de DM2',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11881304/',
  },
  {
    title: 'Adaptação brasileira do FINDRISC',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9671235/',
  },
]

const familyHistoryPoints = {
  none: 0,
  second_degree: 3,
  first_degree: 5,
}

export function ageAtDate(birthDate, referenceDate) {
  const birth = dateParts(birthDate)
  const reference = dateParts(referenceDate)
  if (!birth || !reference || birthDate > referenceDate) return null

  let age = reference.year - birth.year
  if (
    reference.month < birth.month ||
    (reference.month === birth.month && reference.day < birth.day)
  )
    age -= 1
  return age
}

function dateParts(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null
  const [year, month, day] = value.split('-').map(Number)
  const check = new Date(Date.UTC(year, month - 1, day))
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  )
    return null
  return { year, month, day }
}

function numberInput(value, min, max, label) {
  const parsed =
    typeof value === 'string' ? Number(value.trim().replace(',', '.')) : value
  if (
    value === '' ||
    typeof parsed !== 'number' ||
    !Number.isFinite(parsed) ||
    parsed < min ||
    parsed > max
  )
    throw new Error(`${label}: informe um valor entre ${min} e ${max}.`)
  return parsed
}

function yesNo(value, label) {
  if (value === true || value === 'yes') return true
  if (value === false || value === 'no') return false
  throw new Error(`Responda: ${label}.`)
}

function pointsForAge(age) {
  if (age < 45) return 0
  if (age < 55) return 2
  if (age < 65) return 3
  return 4
}

function pointsForBmi(bmi) {
  if (bmi < 25) return 0
  if (bmi <= 30) return 1
  return 3
}

function pointsForWaist(waist, reference) {
  const thresholds = reference === 'female' ? [80, 88] : [94, 102]
  if (waist < thresholds[0]) return 0
  if (waist <= thresholds[1]) return 3
  return 4
}

export function findriscBand(score) {
  if (!Number.isInteger(score) || score < 0 || score > 26) return null
  if (score < 7) return { key: 'low', label: 'Baixo' }
  if (score <= 11) return { key: 'slightly_elevated', label: 'Levemente aumentado' }
  if (score <= 14) return { key: 'moderate', label: 'Moderado' }
  if (score <= 20) return { key: 'high', label: 'Alto' }
  return { key: 'very_high', label: 'Muito alto' }
}

export function calculateFindrisc(values) {
  const age = numberInput(values?.ageYears, 18, 120, 'Idade')
  if (!Number.isInteger(age)) throw new Error('Idade: informe anos completos.')

  const bmi = numberInput(values?.bmi, 10, 100, 'IMC')
  const waist = numberInput(values?.waistCm, 30, 300, 'Cintura')
  const waistReference = values?.waistReference
  if (!['female', 'male'].includes(waistReference))
    throw new Error('Selecione a referência de cintura do questionário.')
  const familyHistory = Object.hasOwn(familyHistoryPoints, values?.familyHistory)
    ? familyHistoryPoints[values.familyHistory]
    : null
  if (familyHistory === null)
    throw new Error('Selecione o histórico familiar de diabetes.')

  const points = {
    age: pointsForAge(age),
    bmi: pointsForBmi(bmi),
    waist: pointsForWaist(waist, waistReference),
    activity: yesNo(values?.dailyActivity, 'atividade física diária'),
    diet: yesNo(values?.dailyFruitVegetables, 'consumo diário de frutas e vegetais'),
    bloodPressureMedication: yesNo(
      values?.hypertensionMedication,
      'uso regular de medicamento para pressão alta',
    ),
    highGlucose: yesNo(values?.highGlucoseHistory, 'histórico de glicose elevada'),
    familyHistory,
  }

  points.activity = points.activity ? 0 : 2
  points.diet = points.diet ? 0 : 1
  points.bloodPressureMedication = points.bloodPressureMedication ? 2 : 0
  points.highGlucose = points.highGlucose ? 5 : 0

  const score = Object.values(points).reduce((total, value) => total + value, 0)
  return { score, maxScore: 26, band: findriscBand(score), points }
}
