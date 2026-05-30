import { Plus } from 'lucide-react'
import { useState } from 'react'
import AIInsightCard from '../components/AIInsightCard'
import AppHeader from '../components/AppHeader'
import HabitRing from '../components/HabitRing'
import HabitItem from '../components/HabitItem'
import MetabolicCard from '../components/MetabolicCard'
import { todayHabits } from '../data/mockData'

const filters = ['Hoje', 'Semana', 'Todos']

export default function Habits() {
  const [activeFilter, setActiveFilter] = useState('Hoje')
  const [habits, setHabits] = useState(todayHabits)
  const completed = habits.filter((habit) => habit.done).length
  const completion = Math.round((completed / habits.length) * 100)

  function toggleHabit(id) {
    setHabits((current) =>
      current.map((habit) => (habit.id === id ? { ...habit, done: !habit.done } : habit)),
    )
  }

  return (
    <>
      <AppHeader title="Hábitos" subtitle="Cuidado diário, sem pressão" simple />

      <MetabolicCard emphasis>
        <div className="flex justify-between">
          <div>
            <p className="text-sm text-soma-200">Progresso de hoje</p>
            <p className="mt-2 text-3xl font-semibold">
              {completed}/{habits.length}
            </p>
          </div>
          <HabitRing value={completion} />
        </div>
        <p className="mt-4 text-xs leading-5 text-soma-200">
          Cada registro amplia sua visão longitudinal. Seu ritmo importa.
        </p>
      </MetabolicCard>

      <div className="mt-6 flex rounded-2xl bg-soma-100 p-1">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
              activeFilter === filter ? 'bg-white text-soma-800 shadow-sm' : 'text-soma-500'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {habits.map((habit) => (
          <HabitItem key={habit.id} habit={habit} onToggle={toggleHabit} />
        ))}
      </div>

      <div className="mt-5">
        <AIInsightCard>
          Registrar seu check-in emocional ajuda a compreender padrões de fome e disposição.
        </AIInsightCard>
      </div>

      <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-soma-300 py-4 font-semibold text-soma-700">
        <Plus className="h-5 w-5" />
        Novo hábito
      </button>
    </>
  )
}
