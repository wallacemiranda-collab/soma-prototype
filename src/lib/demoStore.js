import {
  dateBefore,
  habitDefinitions,
  localDate,
  validateDate,
  validateEntry,
} from './patientData.js'

export const demoStorageKey = 'endo-demo-v1'
const demoProfile = {
  full_name: 'Paciente demonstração',
  birth_date: null,
  sex: null,
  goal_weight: null,
  weekly_exercise_goal: null,
  sleep_goal_hours: null,
}

export function demoSession() {
  return {
    user: {
      id: 'demo-user',
      email: 'demo@exemplo.invalid',
      user_metadata: { full_name: demoProfile.full_name },
    },
  }
}

export function createDemoData() {
  return {
    profile: { ...demoProfile },
    entries: [0, 7, 14].map((days, index) => ({
      id: `demo-${dateBefore(days)}`,
      entry_date: dateBefore(days),
      weight_kg: 82 + index * 0.4,
      waist_cm: null,
      sleep_minutes: 420,
      activity_minutes: 20,
      water_liters: 1.5,
      mood_score: 7,
    })),
    habitLogs: [
      {
        id: 'demo-sleep',
        logged_at: localDate(),
        habit_key: 'sleep',
        value: 1,
      },
    ],
  }
}

function normalize(data) {
  if (
    !data ||
    !Array.isArray(data.entries) ||
    !Array.isArray(data.habitLogs) ||
    data.entries.length > 2000 ||
    data.habitLogs.length > 8000
  )
    throw new Error('Invalid demonstration')
  const entries = data.entries
    .map((value) => {
      const entry = validateEntry(value)
      return { ...entry, id: `demo-${entry.entry_date}` }
    })
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
  const habitLogs = data.habitLogs.map((value) => {
    const date = validateDate(value.logged_at)
    if (
      !habitDefinitions.some((habit) => habit.id === value.habit_key) ||
      ![0, 1].includes(value.value)
    )
      throw new Error('Invalid demonstration habit')
    return {
      id: `demo-${date}-${value.habit_key}`,
      logged_at: date,
      habit_key: value.habit_key,
      value: value.value,
    }
  })
  if (
    new Set(entries.map((entry) => entry.entry_date)).size !== entries.length ||
    new Set(habitLogs.map((log) => `${log.logged_at}:${log.habit_key}`))
      .size !== habitLogs.length
  )
    throw new Error('Duplicate demonstration records')
  // Never restore account identities, tokens or personal details from this cache.
  return { profile: { ...demoProfile }, entries, habitLogs }
}

function browserStorage() {
  try {
    return globalThis.sessionStorage
  } catch {
    return undefined
  }
}

export function createDemoStore(storage = browserStorage()) {
  let memory = null
  let persistent = Boolean(storage)
  function clear() {
    memory = null
    try {
      storage?.removeItem(demoStorageKey)
    } catch {
      persistent = false
    }
  }
  function read() {
    let raw = null
    try {
      raw = persistent ? storage.getItem(demoStorageKey) : null
    } catch {
      persistent = false
    }
    try {
      if (raw !== null) {
        if (raw.length > 1000000) throw new Error('Oversized demonstration')
        const snapshot = JSON.parse(raw)
        if (snapshot.version !== 1 || snapshot.mode !== 'demo')
          throw new Error('Invalid demonstration version')
        memory = normalize(snapshot.data)
      }
      return memory ? normalize(memory) : null
    } catch {
      clear()
      return null
    }
  }
  function save(data) {
    memory = normalize(data)
    if (persistent) {
      try {
        storage.setItem(
          demoStorageKey,
          JSON.stringify({ version: 1, mode: 'demo', data: memory }),
        )
      } catch {
        persistent = false
      }
    }
    return normalize(memory)
  }
  return { read, save, clear, start: () => save(createDemoData()) }
}

export const demoStore = createDemoStore()
