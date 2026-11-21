import { ArrowRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import AIInsightCard from '../components/AIInsightCard'
import HabitItem from '../components/HabitItem'
import MetabolicCard from '../components/MetabolicCard'
import { Feedback, SectionTitle } from '../components/ui'
import { usePatient } from '../contexts/PatientContext'
import {
  formatDate,
  formatNumber,
  habitsForDate,
  localDate,
} from '../lib/patientData'

export default function Home() {
  const { entries, habitLogs, saveHabit } = usePatient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const today = localDate()
  const habits = habitsForDate(habitLogs, today, entries)
  const weight = entries.find((entry) => entry.weight_kg != null)
  const waist = entries.find((entry) => entry.waist_cm != null)
  const completed = habits.filter((habit) => habit.done).length
  async function toggle(id) {
    if (pending) return
    setPending(true)
    setError('')
    try {
      await saveHabit(today, id, !habits.find((habit) => habit.id === id).done)
    } catch {
      setError('Não foi possível salvar o hábito. Tente novamente.')
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <AppHeader subtitle="Seu cuidado, um dia de cada vez" />
      <MetabolicCard emphasis>
        <p className="text-sm text-soma-100">Seu diário de saúde</p>
        <h2 className="mt-3 text-2xl font-semibold">Como foi seu dia?</h2>
        <p className="mt-3 text-sm leading-6 text-soma-100">
          Registre o que faz sentido para você. Cada anotação ajuda a acompanhar
          sua rotina.
        </p>
        <Link
          to="/registro"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-soma-800"
        >
          <Plus size={18} />
          Registrar medidas
        </Link>
      </MetabolicCard>
      <section className="mt-5 grid grid-cols-2 gap-3">
        <MetabolicCard>
          <p className="text-sm text-soma-600">Último peso</p>
          <p className="mt-2 text-xl font-semibold">
            {formatNumber(weight?.weight_kg, ' kg')}
          </p>
          {weight && (
            <p className="mt-2 text-xs text-soma-600">
              {formatDate(weight.entry_date)}
            </p>
          )}
        </MetabolicCard>
        <MetabolicCard>
          <p className="text-sm text-soma-600">Última cintura</p>
          <p className="mt-2 text-xl font-semibold">
            {formatNumber(waist?.waist_cm, ' cm')}
          </p>
          {waist && (
            <p className="mt-2 text-xs text-soma-600">
              {formatDate(waist.entry_date)}
            </p>
          )}
        </MetabolicCard>
      </section>
      <section className="mt-7">
        <SectionTitle title="Hábitos de hoje" />
        <Feedback error={error} />
        <MetabolicCard className="mt-3 space-y-1 !py-3">
          {habits.map((habit) => (
            <HabitItem
              key={habit.id}
              habit={habit}
              compact
              onToggle={toggle}
              disabled={pending}
            />
          ))}
          <p className="pt-3 text-xs text-soma-600">
            {completed} de {habits.length} hábitos marcados
          </p>
        </MetabolicCard>
      </section>
      <div className="mt-5">
        <AIInsightCard>
          {entries.length
            ? `Você tem registros em ${entries.length} dia(s). Consulte sua evolução para rever suas anotações.`
            : 'Sua jornada começa com o primeiro registro. Não é preciso preencher tudo de uma vez.'}
        </AIInsightCard>
      </div>
      <Link
        to="/evolucao"
        className="mt-5 flex items-center justify-between rounded-2xl bg-white p-5 font-semibold text-soma-700"
      >
        Ver meu histórico
        <ArrowRight size={18} />
      </Link>
    </>
  )
}
