import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useAuth } from './AuthContext'
import { dateBefore, localDate } from '../lib/patientData'
import { patientRepository } from '../services/somaDataService'

const PatientContext = createContext(null)
const emptyData = { profile: null, entries: [], habitLogs: [] }

function demoData() {
  return {
    profile: {
      full_name: 'Paciente demonstração',
      goal_weight: null,
      weekly_exercise_goal: null,
      sleep_goal_hours: null,
    },
    entries: [0, 7, 14].map((days, index) => ({
      id: `demo-${index}`,
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

export function PatientProvider({ children }) {
  const { user, isDemo } = useAuth()
  const [data, setData] = useState(emptyData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const generation = useRef(0)

  const reload = useCallback(async () => {
    const request = ++generation.current
    setError('')
    setIsLoading(true)
    try {
      const next = isDemo ? demoData() : await patientRepository.load()
      if (generation.current === request) setData(next)
    } catch {
      if (generation.current === request)
        setError('Não foi possível carregar seus registros. Tente novamente.')
    } finally {
      if (generation.current === request) setIsLoading(false)
    }
  }, [isDemo])

  useEffect(() => {
    reload()
    return () => {
      generation.current += 1
    }
  }, [reload])

  async function saveEntry(values) {
    if (isDemo)
      throw new Error(
        'A demonstração não salva medidas. Use uma conta para registrar seus dados.',
      )
    const request = generation.current
    const entry = await patientRepository.saveEntry(values)
    if (generation.current === request)
      setData((current) => ({
        ...current,
        entries: [
          entry,
          ...current.entries.filter(
            (item) => item.entry_date !== entry.entry_date,
          ),
        ].sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
      }))
    return entry
  }

  async function saveHabit(date, key, completed) {
    const request = generation.current
    const log = isDemo
      ? {
          id: `demo-${date}-${key}`,
          logged_at: date,
          habit_key: key,
          value: completed ? 1 : 0,
        }
      : await patientRepository.saveHabit(date, key, completed)
    if (generation.current === request)
      setData((current) => ({
        ...current,
        habitLogs: [
          log,
          ...current.habitLogs.filter(
            (item) => !(item.logged_at === date && item.habit_key === key),
          ),
        ],
      }))
  }

  async function saveProfile(values) {
    if (isDemo) throw new Error('A demonstração não altera dados de conta.')
    const request = generation.current
    const profile = await patientRepository.saveProfile(values)
    if (generation.current === request)
      setData((current) => ({ ...current, profile }))
  }

  const fullName =
    data.profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Paciente'
  return (
    <PatientContext.Provider
      value={{
        ...data,
        fullName,
        isLoading,
        error,
        reload,
        saveEntry,
        saveHabit,
        saveProfile,
      }}
    >
      {children}
    </PatientContext.Provider>
  )
}

export function usePatient() {
  const context = useContext(PatientContext)
  if (!context)
    throw new Error('usePatient must be used within PatientProvider')
  return context
}
