import { ArrowUpRight, CalendarCheck2 } from 'lucide-react'
import AppHeader from '../components/AppHeader'
import EvolutionGraph from '../components/EvolutionGraph'
import MetabolicCard from '../components/MetabolicCard'
import { areas, timeline, weeklyProgress } from '../data/mockData'
import { Pill, ProgressBar, SectionTitle } from '../components/ui'

export default function Evolution() {
  return (
    <>
      <AppHeader title="Evolução" subtitle="Acompanhe sua história metabólica" simple />

      <MetabolicCard emphasis>
        <p className="text-sm text-soma-200">Evolução longitudinal</p>
        <div className="mt-2 flex items-end justify-between">
          <span className="text-3xl font-semibold">12 semanas</span>
          <Pill tone="yellow">Consistente</Pill>
        </div>
        <div className="mt-7 flex items-center justify-between rounded-2xl bg-white/10 p-4">
          <div className="flex items-center gap-3">
            <CalendarCheck2 className="h-6 w-6 text-soma-300" />
            <div>
              <p className="text-xs text-soma-200">Próximo acompanhamento</p>
              <p className="font-semibold">28 de maio</p>
            </div>
          </div>
          <span className="text-xs text-soma-200">4 dias</span>
        </div>
      </MetabolicCard>

      <MetabolicCard className="mt-5">
        <SectionTitle title="Tendência de hábitos" action="7 dias" />
        <EvolutionGraph points={weeklyProgress} />
      </MetabolicCard>

      <section className="mt-7">
        <SectionTitle title="Indicadores de cuidado" />
        <div className="space-y-3">
          {areas.map((area) => (
            <MetabolicCard key={area.title} className="!p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-medium">{area.title}</span>
                <span className="flex items-center text-sm font-semibold text-soma-600">
                  {area.delta}
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
              <ProgressBar value={area.value} barClassName={area.tone} />
            </MetabolicCard>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <SectionTitle title="Linha do tempo" />
        <MetabolicCard className="space-y-5 !p-4">
          {timeline.map((event) => (
            <div key={event.date} className="flex gap-4">
              <span className="w-14 shrink-0 text-xs font-semibold text-soma-500">{event.date}</span>
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-soma-500" />
              <div>
                <p className="text-sm font-semibold text-soma-900">{event.title}</p>
                <p className="text-xs text-soma-600">{event.description}</p>
              </div>
            </div>
          ))}
        </MetabolicCard>
      </section>
    </>
  )
}
