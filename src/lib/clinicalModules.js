import {
  dateBefore,
  localDate,
  optionalNumber,
  validateDate,
} from './patientData.js'

export const clinicalModules = [
  {
    id: 'diabetes',
    title: 'Diabetes',
    description: 'Glicemias, episódios informados e HbA1c.',
  },
  {
    id: 'glp1',
    title: 'GLP-1 e tirzepatida',
    description: 'Aplicações, locais e sintomas gastrointestinais.',
  },
  {
    id: 'thyroid',
    title: 'Tireoide',
    description: 'Horário da levotiroxina e jejum informado.',
  },
  {
    id: 'pressure',
    title: 'Pressão arterial',
    description: 'Pressão e frequência cardíaca, com data e hora.',
  },
]

export const previewDoctors = [
  { id: 'demo-doctor-a', name: 'Médica A · fictícia' },
  { id: 'demo-doctor-b', name: 'Médico B · fictício' },
]
export const glucoseContexts = [
  ['fasting', 'Jejum'],
  ['before_meal', 'Pré-refeição'],
  ['after_meal', '2 h pós-refeição'],
  ['bedtime', 'Antes de dormir'],
  ['other', 'Outro'],
]
export const injectionSites = [
  ['abdomen', 'Abdome'],
  ['thigh', 'Coxa'],
  ['arm', 'Braço'],
]
export const giSymptoms = [
  ['nausea', 'Náusea'],
  ['vomiting', 'Vômito'],
  ['constipation', 'Constipação'],
  ['diarrhea', 'Diarreia'],
  ['reflux', 'Refluxo'],
]
const timestamp = {
  key: 'occurred_at',
  label: 'Data e hora',
  type: 'datetime-local',
}
const number = (key, label, min, max, optional = false) => ({
  key,
  label,
  type: 'number',
  min,
  max,
  optional,
})
export const clinicalRecordTypes = {
  glucose: {
    module: 'diabetes',
    title: 'Glicemia capilar',
    fields: [
      timestamp,
      number('value', 'Glicemia (mg/dL)', 10, 1000),
      {
        key: 'context',
        label: 'Contexto',
        type: 'select',
        options: glucoseContexts,
      },
    ],
  },
  hypoglycemia: {
    module: 'diabetes',
    title: 'Episódio de hipoglicemia informado',
    fields: [
      timestamp,
      number('value', 'Glicemia no episódio (mg/dL, opcional)', 10, 1000, true),
      {
        key: 'symptoms',
        label: 'Sintomas percebidos',
        type: 'text',
        maxLength: 300,
      },
      {
        key: 'action_taken',
        label: 'O que você fez',
        type: 'text',
        maxLength: 300,
      },
    ],
  },
  hba1c: {
    module: 'diabetes',
    title: 'HbA1c',
    fields: [
      { key: 'occurred_on', label: 'Data do exame', type: 'date' },
      number('value', 'HbA1c (%)', 1, 30),
    ],
  },
  injection: {
    module: 'glp1',
    title: 'Aplicação realizada',
    fields: [
      timestamp,
      {
        key: 'site',
        label: 'Local da aplicação',
        type: 'select',
        options: injectionSites,
      },
    ],
  },
  gi: {
    module: 'glp1',
    title: 'Sintomas gastrointestinais',
    fields: [
      timestamp,
      ...giSymptoms.map(([key, label]) => ({
        key,
        label,
        type: 'select',
        options: [
          ['0', '0 · Ausente'],
          ['1', '1 · Leve'],
          ['2', '2 · Moderado'],
          ['3', '3 · Intenso'],
        ],
      })),
    ],
  },
  thyroid: {
    module: 'thyroid',
    title: 'Tomada de levotiroxina',
    fields: [
      timestamp,
      {
        key: 'fasting',
        label: 'Estava em jejum?',
        type: 'select',
        options: [
          ['yes', 'Sim'],
          ['no', 'Não'],
          ['unsure', 'Não sei informar'],
        ],
      },
    ],
  },
  pressure: {
    module: 'pressure',
    title: 'Pressão arterial',
    fields: [
      timestamp,
      number('systolic', 'Sistólica (mmHg)', 40, 300),
      number('diastolic', 'Diastólica (mmHg)', 20, 200),
      number('pulse', 'Frequência cardíaca (bpm, opcional)', 20, 250, true),
    ],
  },
}

export function localDateTime(now = new Date()) {
  return `${localDate(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function calendarDate(value) {
  return validateDate(value, '9999-12-31')
}

export function validateClinicalRecord(kind, values, now = new Date()) {
  const definition = clinicalRecordTypes[kind]
  if (!definition || !values || typeof values !== 'object')
    throw new Error('Tipo de registro inválido.')
  const result = { kind }
  for (const field of definition.fields) {
    const value = values[field.key]
    if (field.type === 'number') {
      result[field.key] = optionalNumber(
        value,
        field.min,
        field.max,
        field.label,
      )
      if (!field.optional && result[field.key] === null)
        throw new Error(`Preencha ${field.label}.`)
    } else if (field.type === 'date') {
      result[field.key] = validateDate(value, localDate(now))
    } else if (field.type === 'datetime-local') {
      if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
      )
        throw new Error('Informe data e hora válidas.')
      validateDate(value.slice(0, 10), localDate(now))
      const date = new Date(value)
      if (
        !Number.isFinite(date.getTime()) ||
        localDateTime(date) !== value ||
        date > now
      )
        throw new Error('Informe data e hora válidas, não futuras.')
      result[field.key] = value
    } else if (field.type === 'select') {
      if (!field.options.some(([key]) => key === value))
        throw new Error(`Selecione ${field.label}.`)
      result[field.key] = kind === 'gi' ? Number(value) : value
    } else {
      if (
        typeof value !== 'string' ||
        !value.trim() ||
        value.length > field.maxLength
      )
        throw new Error(
          `${field.label}: preencha até ${field.maxLength} caracteres.`,
        )
      result[field.key] = value.trim()
    }
  }
  if (kind === 'pressure' && result.systolic <= result.diastolic)
    throw new Error(
      'Confira a pressão: a sistólica deve ser maior que a diastólica.',
    )
  return result
}

export function validateModuleConfig(moduleId, values = {}) {
  if (!clinicalModules.some((module) => module.id === moduleId))
    throw new Error('Módulo inválido.')
  if (moduleId === 'diabetes') {
    const low = optionalNumber(values.low, 10, 1000, 'Limite inferior')
    const high = optionalNumber(values.high, 10, 1000, 'Limite superior')
    if ((low === null) !== (high === null) || (low !== null && low >= high))
      throw new Error(
        'Informe os dois limites, com o inferior menor que o superior, ou deixe ambos vazios.',
      )
    return { low, high }
  }
  if (moduleId === 'glp1') {
    if (!['Semaglutida', 'Tirzepatida'].includes(values.medication))
      throw new Error('Selecione o medicamento da simulação.')
    const dose_mg = optionalNumber(values.dose_mg, 0.01, 100, 'Dose')
    const interval_days = optionalNumber(
      values.interval_days,
      1,
      90,
      'Intervalo',
      true,
    )
    if (dose_mg === null || interval_days === null)
      throw new Error('Informe dose e intervalo do esquema fictício.')
    return {
      medication: values.medication,
      dose_mg,
      interval_days,
      anchor_date: calendarDate(values.anchor_date),
    }
  }
  return {}
}

export function measurementsInRange(records, range, context = 'all') {
  const readings = records.filter(
    (row) =>
      row.kind === 'glucose' && (context === 'all' || row.context === context),
  )
  if (
    !readings.length ||
    !Number.isFinite(range?.low) ||
    !Number.isFinite(range?.high) ||
    range.low >= range.high
  )
    return null
  const inside = readings.filter(
    (row) => row.value >= range.low && row.value <= range.high,
  ).length
  return {
    inside,
    total: readings.length,
    percent: (inside / readings.length) * 100,
  }
}

export function addCalendarDays(date, days) {
  const value = new Date(`${calendarDate(date)}T12:00:00`)
  value.setDate(value.getDate() + days)
  return localDate(value)
}

export function nextApplication(config, records) {
  if (!config) return null
  const latest = records
    .filter(
      (row) =>
        row.kind === 'injection' && row.plan_revision === config.revision,
    )
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0]
  return latest
    ? addCalendarDays(
        latest.occurred_at.slice(0, 10),
        config.config.interval_days,
      )
    : config.config.anchor_date
}

export function exampleRecords(moduleId, now = new Date()) {
  const at = (days) => `${dateBefore(days, now)}T08:00`
  // Past days keep examples valid even when the preview is opened before 08:00.
  const rows = {
    diabetes: [
      ...[110, 150, 170, 185].map((value, index) => ({
        kind: 'glucose',
        occurred_at: at(4 - index),
        value,
        context: index % 2 ? 'after_meal' : 'fasting',
      })),
      {
        kind: 'hypoglycemia',
        occurred_at: at(2),
        value: 65,
        symptoms: 'Exemplo fictício: tremor',
        action_taken: 'Exemplo fictício: buscou orientação da equipe',
      },
      { kind: 'hba1c', occurred_on: dateBefore(10, now), value: 6.8 },
    ],
    glp1: [
      { kind: 'injection', occurred_at: at(3), site: 'abdomen' },
      {
        kind: 'gi',
        occurred_at: at(2),
        nausea: '1',
        vomiting: '0',
        constipation: '0',
        diarrhea: '0',
        reflux: '0',
      },
    ],
    thyroid: [{ kind: 'thyroid', occurred_at: at(1), fasting: 'yes' }],
    pressure: [
      {
        kind: 'pressure',
        occurred_at: at(1),
        systolic: 120,
        diastolic: 80,
        pulse: 72,
      },
    ],
  }
  return rows[moduleId] ?? []
}
