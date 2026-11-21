import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MetabolicCard from '../components/MetabolicCard'
import { useDoctor } from '../components/DoctorShell'
import {
  Feedback,
  FormField,
  PrimaryButton,
  SelectField,
} from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { states, sharingDeadline } from '../lib/sharing'
import { sharingRepository } from '../services/sharingService'

export default function DoctorDashboard() {
  const { profile, setProfile } = useDoctor()
  const { user } = useAuth()
  const [values, setValues] = useState({
    professional_name: user.user_metadata?.full_name ?? '',
    crm: '',
    crm_state: '',
    confirmed: false,
  })
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState(profile?.share_code ?? '')
  const [codeError, setCodeError] = useState('')
  const [codeMessage, setCodeMessage] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    setCode(profile?.share_code ?? '')
  }, [profile?.share_code])
  useEffect(() => {
    if (!profile) return
    let active = true
    setLoading(true)
    sharingRepository
      .listPatients()
      .then((rows) => {
        if (active) {
          setPatients(rows)
          setError('')
        }
      })
      .catch(() => {
        if (active) {
          setPatients([])
          setError('Não foi possível carregar seus pacientes. Tente novamente.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [profile?.user_id, reload])
  async function register(event) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    try {
      setProfile(await sharingRepository.registerDoctor(values))
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Não foi possível concluir o cadastro. Confira os dados e tente novamente.',
      )
    } finally {
      setPending(false)
    }
  }
  async function saveCode(event) {
    event.preventDefault()
    if (pending || !profile) return
    setPending(true)
    setCodeError('')
    setCodeMessage('')
    try {
      setProfile(await sharingRepository.updateDoctorCode(code))
      setCodeMessage(
        'Código atualizado. As autorizações existentes continuam válidas.',
      )
    } catch (failure) {
      setCodeError(
        failure instanceof Error
          ? failure.message
          : 'Não foi possível salvar o código. Tente novamente para confirmar a alteração.',
      )
    } finally {
      setPending(false)
    }
  }
  const change = (key, value) =>
    setValues((current) => ({ ...current, [key]: value }))
  if (!profile)
    return (
      <>
        <h1 className="text-2xl font-semibold">Cadastro profissional</h1>
        <p className="mb-6 mt-2 text-sm leading-6 text-soma-600">
          Informe seus dados para gerar o código que seus pacientes usarão para
          autorizar o acesso. Nenhum paciente é associado automaticamente.
        </p>
        <MetabolicCard className="max-w-lg">
          <form onSubmit={register} className="space-y-4">
            <FormField
              label="Nome profissional"
              autoComplete="name"
              value={values.professional_name}
              required
              maxLength={100}
              disabled={pending}
              onChange={(event) =>
                change('professional_name', event.target.value)
              }
            />
            <FormField
              label="Número do CRM"
              value={values.crm}
              inputMode="numeric"
              pattern="[0-9]{1,10}"
              required
              maxLength={10}
              disabled={pending}
              onChange={(event) => change('crm', event.target.value)}
            />
            <SelectField
              label="UF do CRM"
              value={values.crm_state}
              required
              disabled={pending}
              onChange={(event) => change('crm_state', event.target.value)}
            >
              <option value="">Selecione</option>
              {states.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </SelectField>
            <label className="flex items-start gap-3 text-sm leading-6">
              <input
                type="checkbox"
                required
                checked={values.confirmed}
                disabled={pending}
                onChange={(event) => change('confirmed', event.target.checked)}
                className="mt-1 h-5 w-5 shrink-0"
              />
              Declaro que sou médico e que os dados profissionais informados são
              verdadeiros.
            </label>
            <p className="text-xs leading-5 text-soma-600">
              Cadastro declarado: o Endo + ainda não verifica o CRM
              automaticamente. Nome e CRM não poderão ser alterados diretamente
              após o cadastro. O código para pacientes poderá ser personalizado.
            </p>
            <Feedback error={error} />
            <PrimaryButton type="submit" disabled={pending}>
              {pending ? 'Cadastrando...' : 'Concluir cadastro profissional'}
            </PrimaryButton>
          </form>
        </MetabolicCard>
      </>
    )
  const visible = patients.filter((patient) =>
    patient.full_name
      .toLocaleLowerCase('pt-BR')
      .includes(search.toLocaleLowerCase('pt-BR')),
  )
  return (
    <>
      <h1 className="text-2xl font-semibold">Meus pacientes</h1>
      <p className="mt-2 text-sm text-soma-600">
        {profile.professional_name} · CRM informado {profile.crm}/
        {profile.crm_state}
      </p>
      <MetabolicCard className="my-6">
        <h2 className="font-semibold">Seu código para os pacientes</h2>
        <p className="mt-2 text-sm leading-6 text-soma-600">
          Envie este código ao paciente. Ele deve abrir Compartilhar evolução,
          conferir seus dados e autorizar o acesso.
        </p>
        <form onSubmit={saveCode} className="mt-4 space-y-3">
          <FormField
            label="Meu código profissional"
            value={code}
            required
            maxLength={48}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={pending}
            onChange={(event) => {
              setCode(event.target.value)
              setCodeError('')
              setCodeMessage('')
            }}
          />
          <p className="text-xs leading-5 text-soma-600">
            Personalize com 6 a 24 letras e números, sem acentos. Espaços e
            hífens são ignorados. Exemplo: DRWALLACE.
          </p>
          <PrimaryButton
            type="submit"
            disabled={pending || code === profile.share_code}
          >
            {pending ? 'Salvando...' : 'Salvar código'}
          </PrimaryButton>
          {code !== profile.share_code && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setCode(profile.share_code)
                setCodeError('')
                setCodeMessage('')
              }}
              className="w-full py-2 text-sm font-semibold text-soma-700"
            >
              Cancelar alteração
            </button>
          )}
        </form>
        <Feedback error={codeError} message={codeMessage} />
        <button
          type="button"
          disabled={pending || code !== profile.share_code}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(profile.share_code)
              setCodeMessage('Código copiado.')
            } catch {
              setCodeMessage(
                'Selecione o código acima e copie para enviar ao paciente.',
              )
            }
          }}
          className="mt-3 py-2 text-sm font-semibold text-soma-700 disabled:opacity-50"
        >
          Copiar código
        </button>
        <p className="mt-2 text-xs leading-5 text-soma-600">
          Ao salvar, o código anterior deixa de aparecer nas novas buscas. As
          autorizações dos seus pacientes continuam válidas. Envie o novo código
          para os próximos compartilhamentos.
        </p>
        <p className="mt-2 text-xs text-soma-600">
          Cadastro declarado, sem validação automática de CRM. O código não
          concede acesso sem a autorização do paciente.
        </p>
      </MetabolicCard>
      <Feedback error={error} />
      <div className="my-5 flex flex-wrap items-end gap-4">
        <FormField
          label="Buscar nos meus pacientes"
          value={search}
          className="min-w-0 flex-1"
          onChange={(event) => setSearch(event.target.value)}
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => setReload((value) => value + 1)}
          className="py-3 text-sm font-semibold text-soma-700"
        >
          Atualizar pacientes
        </button>
      </div>
      {loading ? (
        <p role="status">Carregando pacientes...</p>
      ) : visible.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((patient) => (
            <MetabolicCard key={patient.patient_id}>
              <h2 className="font-semibold">{patient.full_name}</h2>
              <p className="mt-2 text-xs text-soma-600">
                Acesso:{' '}
                {patient.expires_at
                  ? sharingDeadline(patient.expires_at)
                  : 'Até o paciente revogar'}
              </p>
              <Link
                to={`/medico/pacientes/${patient.patient_id}`}
                className="mt-4 inline-block rounded-xl bg-soma-100 px-4 py-3 text-sm font-semibold text-soma-800"
              >
                Ver evolução
              </Link>
            </MetabolicCard>
          ))}
        </div>
      ) : (
        <MetabolicCard>
          <p className="text-sm leading-6 text-soma-600">
            {search
              ? 'Nenhum paciente corresponde à busca.'
              : 'Nenhum paciente autorizou seu acesso. Compartilhe seu código profissional para receber autorizações.'}
          </p>
        </MetabolicCard>
      )}
    </>
  )
}
