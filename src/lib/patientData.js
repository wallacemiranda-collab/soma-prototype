export const habitDefinitions = [
  {
    id: 'sleep',
    title: 'Rotina de sono',
    icon: 'MoonStar',
    time: 'Registrar o cuidado com seu sono',
  },
  {
    id: 'nutrition',
    title: 'Alimentação',
    icon: 'Apple',
    time: 'Registrar suas escolhas do dia',
  },
  {
    id: 'movement',
    title: 'Movimento',
    icon: 'Activity',
    time: 'Registrar sua atividade do dia',
  },
  {
    id: 'wellbeing',
    title: 'Bem-estar',
    icon: 'HeartPulse',
    time: 'Reservar um momento para você',
  },
]

export function localDate(date = new Date()) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function dateBefore(days, now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  date.setDate(date.getDate() - days)
  return localDate(date)
}

export function validateDate(value, today = localDate()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error('Escolha uma data válida.')
  const date = new Date(`${value}T12:00:00`)
  if (
    !Number.isFinite(date.getTime()) ||
    localDate(date) !== value ||
    value > today
  )
    throw new Error('Escolha uma data válida, até hoje.')
  return value
}

const numericFields = {
  weight_kg: [0.1, 800, 'Peso'],
  waist_cm: [1, 500, 'Cintura'],
  sleep_minutes: [0, 1440, 'Sono', true],
  activity_minutes: [0, 1440, 'Atividade', true],
  water_liters: [0, 30, 'Água'],
  mood_score: [1, 10, 'Bem-estar', true],
}

export function optionalNumber(value, min, max, label, integer = false) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  )
    return null
  if (!['number', 'string'].includes(typeof value))
    throw new Error(`${label}: valor inválido.`)
  const number = Number(
    typeof value === 'string' ? value.trim().replace(',', '.') : value,
  )
  if (
    !Number.isFinite(number) ||
    number < min ||
    number > max ||
    (integer && !Number.isInteger(number))
  )
    throw new Error(`${label}: informe um valor entre ${min} e ${max}.`)
  return number
}

export function validateEntry(values) {
  const result = { entry_date: validateDate(values.entry_date) }
  for (const [key, limits] of Object.entries(numericFields))
    result[key] = optionalNumber(values[key], ...limits)
  if (!Object.keys(numericFields).some((key) => result[key] !== null))
    throw new Error('Preencha pelo menos um registro.')
  return result
}

export const sexOptions = [
  { value: 'female', label: 'Feminino' },
  { value: 'male', label: 'Masculino' },
  { value: 'intersex', label: 'Intersexo' },
  { value: 'not_informed', label: 'Prefiro não informar' },
]

export function validatePersonalDetails(values, today = localDate()) {
  const birthDate =
    typeof values.birth_date === 'string'
      ? values.birth_date.trim()
      : values.birth_date
  let birth_date = null
  if (birthDate !== null && birthDate !== undefined && birthDate !== '') {
    try {
      birth_date = validateDate(birthDate, today)
      if (birth_date < '0001-01-01') throw new Error('Invalid year')
    } catch {
      throw new Error('Data de nascimento: informe uma data válida, até hoje.')
    }
  }
  const sex = values.sex === '' || values.sex == null ? null : values.sex
  if (sex !== null && !sexOptions.some((option) => option.value === sex))
    throw new Error('Sexo: selecione uma das opções disponíveis.')
  return { birth_date, sex }
}

export function validateProfile(values) {
  const fullName =
    typeof values.full_name === 'string' ? values.full_name.trim() : ''
  if (!fullName || fullName.length > 100)
    throw new Error('Informe seu nome, com até 100 caracteres.')
  return {
    full_name: fullName,
    ...validatePersonalDetails(values),
    goal_weight: optionalNumber(values.goal_weight, 0.1, 800, 'Meta de peso'),
    weekly_exercise_goal: optionalNumber(
      values.weekly_exercise_goal,
      0,
      10080,
      'Meta de movimento',
      true,
    ),
    sleep_goal_hours: optionalNumber(
      values.sleep_goal_hours,
      0,
      24,
      'Meta de sono',
    ),
  }
}

export function initials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase() || 'P'
  )
}

export function formatNumber(value, suffix = '') {
  return value === null || value === undefined
    ? 'Sem registro'
    : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}${suffix}`
}

export function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`))
}

export function habitsForDate(logs, date, entries = []) {
  const entry = entries.find((value) => value.entry_date === date)
  return habitDefinitions.map((habit) => {
    const value = Number(
      habit.id === 'sleep'
        ? entry?.sleep_minutes
        : habit.id === 'movement'
          ? entry?.activity_minutes
          : 0,
    )
    const automatic = Number.isFinite(value) && value > 0
    return {
      ...habit,
      automatic,
      done:
        automatic ||
        logs.some(
          (log) =>
            log.logged_at === date &&
            log.habit_key === habit.id &&
            Number(log.value) > 0,
        ),
    }
  })
}

export function weeklyHabitProgress(logs, now = new Date(), entries = []) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = dateBefore(6 - index, now)
    const completed = habitsForDate(logs, date, entries).filter(
      (habit) => habit.done,
    ).length
    return {
      day: formatDate(date),
      value: Math.round((completed / habitDefinitions.length) * 100),
    }
  })
}
