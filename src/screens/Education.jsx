import { Bookmark, BookOpen, Clock3, PlayCircle, Search } from 'lucide-react'
import { useState } from 'react'
import AppHeader from '../components/AppHeader'
import MetabolicCard from '../components/MetabolicCard'
import { courses } from '../data/mockData'
import { Pill, ProgressBar } from '../components/ui'

const categories = ['Tudo', 'Metabolismo', 'Sono', 'Nutrição']

export default function Education() {
  const [selected, setSelected] = useState('Tudo')
  const visibleCourses =
    selected === 'Tudo' ? courses : courses.filter((course) => course.category === selected)

  return (
    <>
      <AppHeader title="Educação" subtitle="Conteúdo metabólico confiável" simple />

      <label className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-card">
        <Search className="h-5 w-5 text-soma-400" />
        <input
          placeholder="Buscar conteúdos"
          className="w-full bg-transparent text-sm text-soma-900 outline-none placeholder:text-soma-400"
        />
      </label>

      <div className="hide-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelected(category)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
              selected === category ? 'bg-soma-800 text-white' : 'bg-white text-soma-600'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <MetabolicCard className="mt-6 overflow-hidden !p-0" emphasis>
        <div className="p-5">
          <Pill tone="yellow">Trilha em destaque</Pill>
          <h2 className="mt-4 text-xl font-semibold">Compreenda seu metabolismo</h2>
          <p className="mt-2 text-sm text-soma-200">Ciência acessível para decisões sustentáveis.</p>
          <button className="mt-5 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-soma-800">
            <PlayCircle className="h-5 w-5" />
            Começar trilha
          </button>
        </div>
      </MetabolicCard>

      <div className="mb-4 mt-7 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Suas aulas</h2>
        <button className="text-sm font-semibold text-soma-600">Salvos</button>
      </div>
      <div className="space-y-3">
        {visibleCourses.map((course, index) => (
          <MetabolicCard key={course.title} className="flex gap-3 !p-4">
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${
                index % 2 === 0 ? 'bg-soma-100 text-soma-700' : 'bg-[#fce9e4] text-rose'
              }`}
            >
              <BookOpen className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between">
                <p className="text-xs font-semibold text-soma-500">{course.type} · {course.category}</p>
                <Bookmark className="h-4 w-4 text-soma-400" />
              </div>
              <h3 className="truncate font-semibold">{course.title}</h3>
              <div className="mt-2 flex items-center gap-2 text-xs text-soma-500">
                <Clock3 className="h-3.5 w-3.5" />
                {course.minutes} min · {course.lessons} aulas
              </div>
              {course.progress > 0 && <ProgressBar value={course.progress} className="mt-2 h-1.5" />}
            </div>
          </MetabolicCard>
        ))}
      </div>
    </>
  )
}
