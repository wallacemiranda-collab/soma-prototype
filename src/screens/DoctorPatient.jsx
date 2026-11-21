import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Feedback } from '../components/ui'
import MetabolicCard from '../components/MetabolicCard'
import { EvolutionContent } from './Evolution'
import { formatNumber, sexOptions } from '../lib/patientData'
import { sharingRepository } from '../services/sharingService'

export default function DoctorPatient() {
  const { patientId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    let checking = false
    setData(null)
    setError('')
    sharingRepository
      .loadPatient(patientId)
      .then((value) => {
        if (active) setData(value)
      })
      .catch(() => {
        if (active) {
          setData(null)
          setError(
            'Não foi possível abrir este paciente. A autorização pode ter expirado ou sido revogada.',
          )
        }
      })
    async function checkAccess() {
      if (checking || !active) return
      checking = true
      try {
        if (!(await sharingRepository.canRead(patientId)) && active) {
          setData(null)
          setError('Acesso encerrado ou revogado pelo paciente.')
        }
      } catch {
        if (active) {
          setData(null)
          setError(
            'Não foi possível confirmar a autorização. Atualize para continuar.',
          )
        }
      } finally {
        checking = false
      }
    }
    const interval = setInterval(checkAccess, 30000)
    window.addEventListener('focus', checkAccess)
    return () => {
      active = false
      clearInterval(interval)
      window.removeEventListener('focus', checkAccess)
    }
  }, [patientId, reload])
  return (
    <>
      <Link
        to="/profissional"
        className="mb-6 inline-block py-2 text-sm font-semibold text-soma-700"
      >
        Voltar aos meus pacientes
      </Link>
      {error ? (
        <>
          <Feedback error={error} />
          <button
            type="button"
            onClick={() => setReload((value) => value + 1)}
            className="mt-4 font-semibold text-soma-700"
          >
            Verificar acesso novamente
          </button>
        </>
      ) : !data ? (
        <p role="status">Carregando evolução autorizada...</p>
      ) : (
        <>
          <MetabolicCard className="mb-6">
            <h1 className="text-2xl font-semibold">{data.profile.full_name}</h1>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-soma-600">Nascimento</dt>
                <dd>
                  {data.profile.birth_date
                    ? new Intl.DateTimeFormat('pt-BR').format(
                        new Date(`${data.profile.birth_date}T12:00:00`),
                      )
                    : 'Não informado'}
                </dd>
              </div>
              <div>
                <dt className="text-soma-600">Sexo informado</dt>
                <dd>
                  {sexOptions.find(
                    (option) => option.value === data.profile.sex,
                  )?.label ?? 'Não informado'}
                </dd>
              </div>
              <div>
                <dt className="text-soma-600">Meta pessoal de peso</dt>
                <dd>{formatNumber(data.profile.goal_weight, ' kg')}</dd>
              </div>
              <div>
                <dt className="text-soma-600">Objetivo de movimento</dt>
                <dd>
                  {formatNumber(
                    data.profile.weekly_exercise_goal,
                    ' min/semana',
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-soma-600">Objetivo de sono</dt>
                <dd>{formatNumber(data.profile.sleep_goal_hours, ' h')}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-soma-600">
              Visualização autorizada pelo paciente, somente leitura. As
              anotações não substituem avaliação clínica.
            </p>
            <button
              type="button"
              onClick={() => setReload((value) => value + 1)}
              className="mt-4 py-2 text-sm font-semibold text-soma-700"
            >
              Atualizar evolução
            </button>
          </MetabolicCard>
          <EvolutionContent
            entries={data.entries}
            habitLogs={data.habitLogs}
            readOnly
          />
        </>
      )}
    </>
  )
}
