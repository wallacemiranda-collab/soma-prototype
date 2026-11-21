import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import MetabolicCard from '../components/MetabolicCard'
import PersonalDetailsFields from '../components/PersonalDetailsFields'
import { Feedback, FormField, PrimaryButton } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { usePatient } from '../contexts/PatientContext'
import { brand } from '../config/brand'
import { initials } from '../lib/patientData'

export default function Profile() {
  const { user, isDemo, signOut } = useAuth()
  const { profile, fullName, saveProfile } = usePatient()
  const navigate = useNavigate()
  const [values, setValues] = useState({})
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    setValues({
      full_name: fullName,
      birth_date: profile?.birth_date ?? '',
      sex: profile?.sex ?? '',
      goal_weight: profile?.goal_weight ?? '',
      weekly_exercise_goal: profile?.weekly_exercise_goal ?? '',
      sleep_goal_hours: profile?.sleep_goal_hours ?? '',
    })
  }, [profile, fullName])
  async function submit(event) {
    event.preventDefault()
    if (pending || isDemo) return
    setPending(true)
    setError('')
    setMessage('')
    try {
      await saveProfile(values)
      setMessage('Perfil atualizado.')
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Não foi possível atualizar o perfil. Tente novamente.',
      )
    } finally {
      setPending(false)
    }
  }
  async function leave() {
    if (pending) return
    setPending(true)
    setError('')
    try {
      const result = await signOut()
      if (result.error) throw result.error
      navigate('/login', { replace: true })
    } catch {
      setError('Não foi possível sair. Tente novamente.')
      setPending(false)
    }
  }
  return (
    <>
      <AppHeader title="Meu perfil" simple />
      <Link
        to="/compartilhar"
        className="mb-5 block rounded-2xl bg-soma-100 p-4 font-semibold text-soma-800"
      >
        Minha equipe de saúde
      </Link>
      <section className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-soma-800 text-xl font-semibold text-white">
          {initials(fullName)}
        </div>
        <div className="min-w-0">
          <h2 className="break-words text-xl font-semibold">{fullName}</h2>
          <p className="break-all text-sm text-soma-600">
            {isDemo ? 'Conta de demonstração' : user.email}
          </p>
        </div>
      </section>
      <MetabolicCard>
        <h2 className="mb-4 font-semibold">Meus dados e objetivos</h2>
        <form onSubmit={submit} className="space-y-4">
          <FormField
            label="Nome completo"
            value={values.full_name ?? ''}
            required
            maxLength={100}
            autoComplete="name"
            disabled={pending || isDemo}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                full_name: event.target.value,
              }))
            }
          />
          <PersonalDetailsFields
            values={values}
            disabled={pending || isDemo}
            onChange={(changes) =>
              setValues((current) => ({ ...current, ...changes }))
            }
          />
          <FormField
            label="Meta pessoal de peso (kg, opcional)"
            type="number"
            min="0.1"
            max="800"
            step="0.1"
            value={values.goal_weight ?? ''}
            disabled={pending || isDemo}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                goal_weight: event.target.value,
              }))
            }
          />
          <FormField
            label="Objetivo de movimento (min/semana, opcional)"
            type="number"
            min="0"
            max="10080"
            step="1"
            value={values.weekly_exercise_goal ?? ''}
            disabled={pending || isDemo}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                weekly_exercise_goal: event.target.value,
              }))
            }
          />
          <FormField
            label="Objetivo de sono (horas, opcional)"
            type="number"
            min="0"
            max="24"
            step="0.1"
            value={values.sleep_goal_hours ?? ''}
            disabled={pending || isDemo}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                sleep_goal_hours: event.target.value,
              }))
            }
          />
          <p className="text-xs leading-5 text-soma-600">
            Seus objetivos são pessoais e podem ser ajustados com o profissional
            que acompanha você.
          </p>
          <Feedback error={error} message={message} />
          <PrimaryButton type="submit" disabled={pending || isDemo}>
            {pending ? 'Aguarde...' : 'Salvar perfil'}
          </PrimaryButton>
        </form>
      </MetabolicCard>
      <a
        href={brand.clinic.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 block rounded-2xl bg-white p-5 font-semibold text-soma-600"
      >
        Conheça a {brand.clinic.name}
      </a>
      <button
        type="button"
        onClick={leave}
        disabled={pending}
        className="mt-4 w-full rounded-xl py-4 font-semibold text-soma-600 disabled:opacity-50"
      >
        {isDemo ? 'Sair da demonstração' : 'Sair da conta'}
      </button>
      {!isDemo && (
        <Link
          to="/profissional"
          className="mt-3 block py-3 text-center text-sm font-semibold text-soma-600"
        >
          Acessar área profissional
        </Link>
      )}
    </>
  )
}
