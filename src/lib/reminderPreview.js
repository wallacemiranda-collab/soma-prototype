export const reminderPreviewKey = 'endo-reminders-preview-v1'
export const reminderKinds = [
  {
    id: 'medication',
    label: 'Medicação (exemplo)',
    frequency: 'daily',
    time: '08:00',
  },
  {
    id: 'application',
    label: 'Aplicação semanal (exemplo)',
    frequency: 'weekly',
    time: '09:00',
    weekday: 1,
  },
  {
    id: 'weight',
    label: 'Pesagem semanal',
    frequency: 'weekly',
    time: '08:00',
    weekday: 1,
  },
  { id: 'daily', label: 'Registro diário', frequency: 'daily', time: '20:00' },
]
export const weekdays = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

export function validTimeZone(value) {
  if (typeof value !== 'string' || value.length > 80) return false
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: value })
    return true
  } catch {
    return false
  }
}
export function emptyReminderPreview(timeZone = 'America/Sao_Paulo') {
  return {
    enabled: false,
    timeZone: validTimeZone(timeZone) ? timeZone : 'America/Sao_Paulo',
    quiet: { enabled: true, start: '22:00', end: '08:00' },
    rules: reminderKinds.map(({ id, time, weekday }) => ({
      id,
      enabled: false,
      time,
      ...(weekday == null ? {} : { weekday }),
    })),
  }
}
function minutes(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new Error('Informe um horário válido, com horas e minutos.')
  const [hours, mins] = value.split(':').map(Number)
  return hours * 60 + mins
}
export function validateReminderPreview(value) {
  if (
    !value ||
    typeof value.enabled !== 'boolean' ||
    !validTimeZone(value.timeZone) ||
    !value.quiet ||
    typeof value.quiet.enabled !== 'boolean' ||
    !Array.isArray(value.rules) ||
    value.rules.length !== reminderKinds.length
  )
    throw new Error('Confira as preferências da simulação.')
  const start = minutes(value.quiet.start),
    end = minutes(value.quiet.end)
  if (value.quiet.enabled && start === end)
    throw new Error(
      'O início e o fim do período de silêncio devem ser diferentes.',
    )
  const rules = reminderKinds.map((kind) => {
    const matches = value.rules.filter((rule) => rule?.id === kind.id)
    if (matches.length !== 1 || typeof matches[0].enabled !== 'boolean')
      throw new Error('Confira os lembretes da simulação.')
    const rule = matches[0]
    minutes(rule.time)
    if (
      kind.frequency === 'weekly' &&
      (!Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 6)
    )
      throw new Error('Selecione um dia da semana válido.')
    return {
      id: kind.id,
      enabled: rule.enabled,
      time: rule.time,
      ...(kind.frequency === 'weekly' ? { weekday: rule.weekday } : {}),
    }
  })
  return {
    enabled: value.enabled,
    timeZone: value.timeZone,
    quiet: {
      enabled: value.quiet.enabled,
      start: value.quiet.start,
      end: value.quiet.end,
    },
    rules,
  }
}
export function isQuietTime(quiet, time) {
  const now = minutes(time),
    start = minutes(quiet.start),
    end = minutes(quiet.end)
  if (!quiet.enabled) return false
  return start < end ? now >= start && now < end : now >= start || now < end
}
export function simulateReminderPreview(value, { time, weekday }) {
  const state = validateReminderPreview(value)
  minutes(time)
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6)
    throw new Error('Selecione um dia da semana válido.')
  if (!state.enabled) return { status: 'disabled', labels: [] }
  if (isQuietTime(state.quiet, time)) return { status: 'quiet', labels: [] }
  const labels = state.rules
    .filter(
      (rule) =>
        rule.enabled &&
        rule.time === time &&
        (rule.weekday == null || rule.weekday === weekday),
    )
    .map((rule) => reminderKinds.find((kind) => kind.id === rule.id).label)
  return { status: labels.length ? 'due' : 'empty', labels }
}
function browserStorage() {
  try {
    return globalThis.sessionStorage
  } catch {
    return undefined
  }
}
export function createReminderPreviewStore(storage = browserStorage()) {
  let memory = null
  let persistent = Boolean(storage)
  function clear() {
    memory = null
    try {
      storage?.removeItem(reminderPreviewKey)
    } catch {
      persistent = false
    }
  }
  function read(timeZone) {
    try {
      const raw = persistent ? storage.getItem(reminderPreviewKey) : null
      if (raw != null) {
        if (raw.length > 5000) throw new Error('Oversized preview')
        const snapshot = JSON.parse(raw)
        if (snapshot.version !== 1 || snapshot.mode !== 'reminders-demo')
          throw new Error('Invalid preview')
        memory = validateReminderPreview(snapshot.data)
      }
    } catch {
      clear()
      persistent = false
    }
    return memory
      ? validateReminderPreview(memory)
      : emptyReminderPreview(timeZone)
  }
  function save(value) {
    memory = validateReminderPreview(value)
    if (persistent) {
      try {
        storage.setItem(
          reminderPreviewKey,
          JSON.stringify({ version: 1, mode: 'reminders-demo', data: memory }),
        )
      } catch {
        persistent = false
        try {
          storage.removeItem(reminderPreviewKey)
        } catch {
          /* Memory-only simulation. */
        }
      }
    }
    return validateReminderPreview(memory)
  }
  return { read, save, clear, isPersistent: () => persistent }
}
export const reminderPreviewStore = createReminderPreviewStore()
