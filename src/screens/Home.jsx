import { Activity, Flame, MoonStar, Play } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AIInsightCard from '../components/AIInsightCard'
import AppHeader from '../components/AppHeader'
import HabitItem from '../components/HabitItem'
import MetabolicCard from '../components/MetabolicCard'
import { todayHabits, user } from '../data/mockData'
import { ProgressBar, SectionTitle } from '../components/ui'

export default function Home() {
  const navigate = useNavigate()
  const [habits, setHabits] = useState(todayHabits)
  const completed = habits.filter((habit) => habit.done).length

  function toggleHabit(id) {
    setHabits((current) =>
      current.map((habit) => (habit.id === id ? { ...habit, done: !habit.done } : habit)),
    )
  }

  return (
    <>
      <AppHeader />
      <MetabolicCard emphasis>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-soma-200">
              <Flame className="h-4 w-4 text-sun" />
              {user.streak} dias de cuidado contínuo
            </div>
            <h2 className="mt-4 text-2xl font-semibold">Jornada metabólica</h2>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
            {user.level}
          </span>
        </div>
        <div className="mt-6 flex items-end justify-between text-sm">
          <span>Meta de 12 semanas</span>
          <span className="text-soma-200">{user.progress}% acompanhada</span>
        </div>
        <ProgressBar value={user.progress} className="mt-3 bg-white/15" barClassName="bg-sun" />
      </MetabolicCard>

      <div className="mt-4">
        <AIInsightCard>
          Seu sono esteve mais regular esta semana. Manter o horário pode apoiar sua disposição hoje.
        </AIInsightCard>
      </div>

      <div className="mt-7">
        <SectionTitle
          title="Hábitos de hoje"
          action="Ver todos"
          onClick={() => navigate('/habitos')}
        />
        <MetabolicCard className="space-y-1 !py-3">
          {habits.slice(0, 3).map((habit) => (
            <HabitItem key={habit.id} habit={habit} compact onToggle={toggleHabit} />
          ))}
          <p className="pt-2 text-center text-xs text-soma-500">
            {completed} de {habits.length} hábitos concluídos hoje
          </p>
        </MetabolicCard>
      </div>

      <div className="mt-7">
        <SectionTitle title="Recomendado para você" />
        <MetabolicCard className="flex items-center gap-4 !bg-soma-50">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-soma-700">
            <Activity className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-soma-600">METABOLISMO</p>
            <h3 className="mt-1 font-semibold text-soma-900">Movimento após refeições</h3>
            <p className="text-xs text-soma-600">Vídeo · 8 min</p>
          </div>
          <button
            aria-label="Reproduzir aula"
            onClick={() => navigate('/educacao')}
            className="rounded-full bg-soma-800 p-3 text-white"
          >
            <Play className="h-4 w-4 fill-white" />
          </button>
        </MetabolicCard>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MetabolicCard className="!p-4">
          <MoonStar className="mb-3 h-5 w-5 text-soma-500" />
          <p className="text-xs text-soma-600">Sono médio</p>
          <p className="mt-1 text-xl font-semibold">7h 34</p>
        </MetabolicCard>
        <MetabolicCard className="!p-4">
          <Activity className="mb-3 h-5 w-5 text-soma-500" />
          <p className="text-xs text-soma-600">Movimento</p>
          <p className="mt-1 text-xl font-semibold">64%</p>
        </MetabolicCard>
      </div>
    </>
  )
}
