import { useState } from 'react'
import AppHeader from '../components/AppHeader'
import HabitItem from '../components/HabitItem'
import HabitRing from '../components/HabitRing'
import MetabolicCard from '../components/MetabolicCard'
import { Feedback, FormField } from '../components/ui'
import { usePatient } from '../contexts/PatientContext'
import { useAuth } from '../contexts/AuthContext'
import { useFoodDiaryPreview } from '../contexts/FoodDiaryPreviewContext'
import { foodDiaryFlags } from '../config/foodDiary.js'
import { dateBefore, habitsForDate, localDate } from '../lib/patientData'
import { Link } from 'react-router-dom'

export default function Habits() {
  const { habitLogs, entries, saveHabit } = usePatient()
  const { isDemo } = useAuth()
  const { preferences } = useFoodDiaryPreview()
  const [date, setDate] = useState(localDate())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const habits = habitsForDate(habitLogs, date, entries)
  const completed = habits.filter((habit) => habit.done).length
  async function toggle(id) {
    if (pending) return
    setPending(true)
    setError('')
    try {
      await saveHabit(date, id, !habits.find((habit) => habit.id === id).done)
    } catch {
      setError(
        'Não foi possível salvar. Confira sua conexão e tente novamente.',
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <AppHeader
        title="Hábitos"
        subtitle="Seu ritmo, suas pequenas escolhas"
        simple
      />
      <FormField
        label="Dia do registro"
        type="date"
        value={date}
        max={localDate()}
        min={dateBefore(365)}
        required
        disabled={pending}
        onChange={(event) => {
          if (event.target.value) {
            setDate(event.target.value)
            setError('')
          }
        }}
      />
      <MetabolicCard emphasis className="mt-5">
        <div className="flex justify-between">
          <div>
            <p className="text-sm text-soma-100">Hábitos marcados neste dia</p>
            <p className="mt-2 text-3xl font-semibold">
              {completed}/{habits.length}
            </p>
          </div>
          <HabitRing value={Math.round((completed / habits.length) * 100)} />
        </div>
        <p className="mt-4 text-sm text-soma-100">
          Marque ou desmarque um hábito para atualizar o registro. Sono e
          movimento também são marcados quando há duração maior que zero nas
          medidas desse dia. Isso indica um registro, não uma avaliação da
          qualidade.
        </p>
      </MetabolicCard>
      {isDemo && foodDiaryFlags.previewVisible && preferences.enabled && (
        <section className="mt-5 rounded-3xl border border-soma-200 bg-white p-5 shadow-card">
          <h2 className="text-lg font-semibold text-soma-900">Alimentação</h2>
          <p className="mt-2 text-sm leading-6 text-soma-700">
            Registre uma refeição de forma simples. Esta prévia usa apenas dados fictícios e estimativas por quantidade informada.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/alimentacao"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-soma-800 px-5 py-3 font-semibold text-white"
            >
              Abrir diário alimentar
            </Link>
            <Link
              to="/alimentacao/nutricionista"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-soma-200 px-5 py-3 text-sm font-semibold text-soma-800"
            >
              Ver prévia da nutricionista
            </Link>
          </div>
        </section>
      )}
      <div className="mt-5">
        <Feedback error={error} />
      </div>
      <div className="mt-4 space-y-3">
        {habits.map((habit) => (
          <HabitItem
            key={habit.id}
            habit={habit}
            onToggle={toggle}
            disabled={pending}
          />
        ))}
      </div>
    </>
  )
}
