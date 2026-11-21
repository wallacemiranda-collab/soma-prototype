import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import EvolutionGraph from '../components/EvolutionGraph'
import MetabolicCard from '../components/MetabolicCard'
import { usePatient } from '../contexts/PatientContext'
import {
  dateBefore,
  formatDate,
  formatNumber,
  weeklyHabitProgress,
} from '../lib/patientData'

export default function Evolution() {
  const { entries, habitLogs } = usePatient()
  return <EvolutionContent entries={entries} habitLogs={habitLogs} />
}

export function EvolutionContent({ entries, habitLogs, readOnly = false }) {
  const [days, setDays] = useState(30)
  const [count, setCount] = useState(20)
  const visible = entries.filter(
    (entry) => !days || entry.entry_date >= dateBefore(days - 1),
  )
  const weights = visible
    .filter((entry) => entry.weight_kg !== null)
    .slice()
    .reverse()
  const current = weights.at(-1)?.weight_kg
  const difference =
    weights.length > 1 ? Number(current) - Number(weights[0].weight_kg) : null
  return (
    <>
      {readOnly ? (
        <header className="mb-6">
          <h2 className="text-2xl font-semibold text-soma-900">
            Evolução do paciente
          </h2>
          <p className="mt-2 text-sm text-soma-600">
            Registros informados pelo paciente · somente leitura
          </p>
        </header>
      ) : (
        <AppHeader
          title="Sua evolução"
          subtitle="Histórico das suas próprias anotações"
          simple
        />
      )}
      {!readOnly && (
        <Link
          to="/compartilhar"
          className="mb-5 inline-block rounded-xl bg-soma-100 px-4 py-3 text-sm font-semibold text-soma-800"
        >
          Compartilhar evolução
        </Link>
      )}
      <div className="mb-5 flex flex-wrap gap-2">
        {[7, 30, 90, 0].map((period) => (
          <button
            key={period}
            type="button"
            aria-pressed={days === period}
            onClick={() => {
              setDays(period)
              setCount(20)
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${days === period ? 'bg-soma-800 text-white' : 'bg-white text-soma-600'}`}
          >
            {period ? `${period} dias` : 'Todo o histórico'}
          </button>
        ))}
      </div>
      <section className="grid grid-cols-2 gap-3">
        <MetabolicCard>
          <p className="text-sm text-soma-600">Último peso no período</p>
          <p className="mt-2 text-xl font-semibold">
            {formatNumber(current, ' kg')}
          </p>
        </MetabolicCard>
        <MetabolicCard>
          <p className="text-sm text-soma-600">Variação no período</p>
          <p
            className={`mt-2 font-semibold ${difference === null ? 'text-sm' : 'text-xl'}`}
          >
            {difference === null
              ? 'Sem comparação'
              : `${difference > 0 ? '+' : ''}${formatNumber(difference, ' kg')}`}
          </p>
        </MetabolicCard>
      </section>
      <MetabolicCard className="mt-5">
        <h2 className="mb-4 font-semibold">Peso registrado</h2>
        {weights.length ? (
          <EvolutionGraph
            points={weights.map((entry) => ({
              day: formatDate(entry.entry_date),
              value: Number(entry.weight_kg),
            }))}
            label="Peso registrado, em quilogramas"
          />
        ) : (
          <p className="text-sm text-soma-600">
            Ainda não há medidas de peso neste período.
          </p>
        )}
      </MetabolicCard>
      <MetabolicCard className="mt-5">
        <h2 className="mb-4 font-semibold">
          Hábitos marcados · últimos 7 dias
        </h2>
        <EvolutionGraph
          points={weeklyHabitProgress(habitLogs, new Date(), entries)}
          label="Percentual de hábitos marcados por dia"
        />
      </MetabolicCard>
      <section className="mt-7">
        <h2 className="mb-4 text-lg font-semibold">Registros no período</h2>
        {!visible.length ? (
          <MetabolicCard>
            <p className="text-sm text-soma-600">
              Seu histórico aparecerá aqui depois do primeiro registro.
            </p>
            {!readOnly && (
              <Link
                to="/registro"
                className="mt-4 inline-block font-semibold text-soma-600"
              >
                Fazer meu primeiro registro
              </Link>
            )}
          </MetabolicCard>
        ) : (
          <div className="space-y-3">
            {visible.slice(0, count).map((entry) => (
              <MetabolicCard key={entry.id}>
                <h3 className="font-semibold">
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'medium',
                  }).format(new Date(`${entry.entry_date}T12:00:00`))}
                </h3>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Peso', formatNumber(entry.weight_kg, ' kg')],
                    ['Cintura', formatNumber(entry.waist_cm, ' cm')],
                    [
                      'Sono',
                      formatNumber(
                        entry.sleep_minutes === null
                          ? null
                          : entry.sleep_minutes / 60,
                        ' h',
                      ),
                    ],
                    ['Movimento', formatNumber(entry.activity_minutes, ' min')],
                    ['Água', formatNumber(entry.water_liters, ' L')],
                    ['Bem-estar', formatNumber(entry.mood_score, '/10')],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-soma-600">{label}</dt>
                      <dd className="mt-1">{value}</dd>
                    </div>
                  ))}
                </dl>
                {!readOnly && (
                  <Link
                    to={`/registro?data=${entry.entry_date}`}
                    className="mt-4 inline-block text-sm font-semibold text-soma-600"
                  >
                    Editar registro
                  </Link>
                )}
              </MetabolicCard>
            ))}
            {visible.length > count && (
              <button
                type="button"
                onClick={() => setCount((currentCount) => currentCount + 20)}
                className="w-full rounded-xl bg-white p-4 font-semibold text-soma-800"
              >
                Mostrar mais registros
              </button>
            )}
          </div>
        )}
      </section>
    </>
  )
}
