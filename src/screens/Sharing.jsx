import { useEffect, useState } from 'react'
import AppHeader from '../components/AppHeader'
import MetabolicCard from '../components/MetabolicCard'
import {
  Feedback,
  FormField,
  PrimaryButton,
  SelectField,
} from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import {
  sharingDeadline,
  sharingStatus,
  professionalIdentity,
} from '../lib/sharing'
import { sharingRepository } from '../services/sharingService'

export default function Sharing() {
  const { isDemo } = useAuth()
  const [doctors, setDoctors] = useState([])
  const [code, setCode] = useState('')
  const [selected, setSelected] = useState(null)
  const [days, setDays] = useState('30')
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(!isDemo)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    if (isDemo) return
    let active = true
    setLoading(true)
    sharingRepository
      .listDoctors()
      .then((rows) => {
        if (active) {
          setDoctors(rows)
          setError('')
        }
      })
      .catch(() => {
        if (active)
          setError(
            'Não foi possível carregar seus compartilhamentos. Tente novamente.',
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [isDemo, reload])
  async function lookup(event) {
    event.preventDefault()
    if (pending || isDemo) return
    setPending(true)
    setError('')
    setMessage('')
    setSelected(null)
    setConfirmed(false)
    try {
      const doctor = await sharingRepository.lookupDoctor(code)
      if (!doctor)
        throw new Error(
          'Nenhum profissional encontrado. Confira o código e peça que ele conclua o cadastro profissional.',
        )
      setSelected(doctor)
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Não foi possível buscar o profissional.',
      )
    } finally {
      setPending(false)
    }
  }
  async function grant(event) {
    event.preventDefault()
    if (pending || isDemo) return
    setPending(true)
    setError('')
    setMessage('')
    try {
      await sharingRepository.grant({
        doctor_id: selected.doctor_id,
        days,
        confirmed,
      })
      setMessage(
        'Autorização salva. O profissional poderá consultar sua evolução durante o prazo escolhido. Você pode adicionar outros profissionais pelo código.',
      )
      setSelected(null)
      setCode('')
      setConfirmed(false)
      setReload((value) => value + 1)
    } catch {
      setError(
        'Não foi possível autorizar o acesso. Confira sua conexão e tente novamente.',
      )
    } finally {
      setPending(false)
    }
  }
  async function revoke(id) {
    if (pending || isDemo) return
    setPending(true)
    setError('')
    setMessage('')
    try {
      await sharingRepository.revoke(id)
      setDoctors((rows) =>
        rows.map((row) =>
          row.doctor_id === id
            ? { ...row, revoked_at: new Date().toISOString() }
            : row,
        ),
      )
      setMessage(
        'Acesso revogado. Novas consultas aos seus dados estão bloqueadas para este profissional. Os demais acessos não foram alterados.',
      )
    } catch {
      setError('Não foi possível revogar o acesso. Tente novamente.')
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <AppHeader
        title="Minha equipe de saúde"
        subtitle="Você escolhe quem acompanha sua evolução"
        simple
      />
      <MetabolicCard>
        <p className="text-sm leading-6 text-soma-600">
          Adicione vários médicos e outros profissionais de saúde, um por vez,
          usando o código de cada um. Você autoriza e revoga cada acesso de
          forma independente. O acesso é somente para leitura do seu nome,
          nascimento, sexo, objetivos, medidas e hábitos, incluindo registros
          futuros enquanto a autorização estiver ativa.
        </p>
        {isDemo && (
          <p className="mt-4 rounded-xl bg-soma-100 p-3 text-sm">
            A demonstração não compartilha dados. Entre com sua conta para
            autorizar um profissional.
          </p>
        )}
        <form onSubmit={lookup} className="mt-5 space-y-4">
          <h2 className="font-semibold">Adicionar profissional por código</h2>
          <FormField
            label="Código do profissional"
            value={code}
            autoComplete="off"
            maxLength={48}
            disabled={pending || isDemo}
            required
            onChange={(event) => {
              setCode(event.target.value)
              setSelected(null)
              setConfirmed(false)
            }}
          />
          <PrimaryButton type="submit" disabled={pending || isDemo}>
            {pending ? 'Aguarde...' : 'Buscar profissional'}
          </PrimaryButton>
        </form>
        {selected && (
          <form
            onSubmit={grant}
            className="mt-5 space-y-4 border-t border-soma-100 pt-5"
          >
            <div>
              <h2 className="break-words font-semibold">
                {selected.professional_name}
              </h2>
              <p className="mt-1 break-words text-sm text-soma-600">
                {professionalIdentity(selected)}
              </p>
              <p className="mt-2 text-xs leading-5 text-soma-600">
                Cadastro declarado, sem verificação automática do registro.
                Confirme estes dados diretamente com o profissional antes de
                autorizar.
              </p>
            </div>
            <SelectField
              label="Prazo de acesso"
              value={days}
              disabled={pending}
              onChange={(event) => {
                setDays(event.target.value)
                setConfirmed(false)
              }}
            >
              <option value="7">7 dias</option>
              <option value="30">30 dias</option>
              <option value="90">90 dias</option>
              <option value="">Até eu revogar</option>
            </SelectField>
            <label className="flex items-start gap-3 text-sm leading-6 text-soma-800">
              <input
                className="mt-1 h-5 w-5 shrink-0"
                type="checkbox"
                checked={confirmed}
                required
                disabled={pending}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              Autorizo este profissional a consultar meu perfil e minha evolução
              durante o prazo selecionado. Posso revogar o acesso a qualquer
              momento.
            </label>
            <PrimaryButton type="submit" disabled={pending || !confirmed}>
              Autorizar acesso
            </PrimaryButton>
          </form>
        )}
      </MetabolicCard>
      <div className="mt-5">
        <Feedback error={error} message={message} />
      </div>
      <section className="mt-7 space-y-3" aria-label="Meus compartilhamentos">
        <h2 className="text-lg font-semibold">Meus profissionais</h2>
        {loading ? (
          <p role="status">Carregando compartilhamentos...</p>
        ) : doctors.length ? (
          doctors.map((doctor) => (
            <MetabolicCard key={doctor.doctor_id}>
              <h3 className="break-words font-semibold">
                {doctor.professional_name}
              </h3>
              <p className="mt-1 break-words text-sm text-soma-600">
                {professionalIdentity(doctor)}
              </p>
              <p className="mt-3 text-sm font-semibold">
                {sharingStatus(doctor)}
              </p>
              <p className="mt-1 text-xs text-soma-600">
                Prazo: {sharingDeadline(doctor.expires_at)}
              </p>
              {sharingStatus(doctor) === 'Ativo' && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => revoke(doctor.doctor_id)}
                  className="mt-4 rounded-xl border border-soma-200 px-4 py-3 text-sm font-semibold text-soma-800 disabled:opacity-50"
                >
                  Revogar acesso
                </button>
              )}
            </MetabolicCard>
          ))
        ) : (
          <p className="text-sm text-soma-600">
            Nenhum profissional autorizado por você. Adicione o primeiro pelo
            código acima.
          </p>
        )}
        {!isDemo && (
          <button
            type="button"
            onClick={() => setReload((value) => value + 1)}
            disabled={loading || pending}
            className="py-3 text-sm font-semibold text-soma-700"
          >
            Atualizar compartilhamentos
          </button>
        )}
      </section>
      <p className="mt-5 text-xs leading-5 text-soma-600">
        Revogar impede novas consultas no Endo +, mas não elimina cópias que o
        profissional já tenha obtido durante uma autorização válida.
      </p>
    </>
  )
}
