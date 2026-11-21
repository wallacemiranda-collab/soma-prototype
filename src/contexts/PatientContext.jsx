import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useAuth } from './AuthContext'
import { demoStore } from '../lib/demoStore'
import { localDate, optionalNumber, validateEntry } from '../lib/patientData'
import { entryHeight, heightBounds } from '../lib/anthropometry'
import { patientRepository } from '../services/somaDataService'

const PatientContext = createContext(null)
const emptyData = { profile: null, entries: [], habitLogs: [] }

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
      const next = isDemo ? demoStore.read() : await patientRepository.load()
      if (!next) throw new Error('Reinicie a demonstração para continuar.')
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

  function updateData(update) {
    if (isDemo) {
      const current = demoStore.read()
      if (!current) throw new Error('Reinicie a demonstração para continuar.')
      setData(demoStore.save(update(current)))
    } else setData(update)
  }

  async function saveEntry(values) {
    const request = generation.current
    const existing = data.entries.find(
      (entry) => entry.entry_date === values.entry_date,
    )
    const record = {
      ...values,
      height_cm: entryHeight(
        data.profile,
        existing,
        values.entry_date,
        localDate(),
      ),
    }
    const entry = isDemo
      ? { ...validateEntry(record), id: `demo-${values.entry_date}` }
      : await patientRepository.saveEntry(record)
    if (generation.current === request) {
      const update = (current) => ({
        ...current,
        entries: [
          entry,
          ...current.entries.filter(
            (item) => item.entry_date !== entry.entry_date,
          ),
        ].sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
      })
      updateData(update)
    }
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
      updateData((current) => ({
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
    const request = generation.current
    const profile = isDemo
      ? {
          ...data.profile,
          height_cm: optionalNumber(
            values.height_cm,
            heightBounds.min,
            heightBounds.max,
            'Altura',
          ),
        }
      : await patientRepository.saveProfile({
          ...data.profile,
          ...values,
          full_name: values.full_name ?? fullName,
        })
    if (generation.current === request)
      updateData((current) => ({ ...current, profile }))
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
