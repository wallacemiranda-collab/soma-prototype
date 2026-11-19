import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BrandMark from '../components/BrandMark'
import { Feedback, FormField, PrimaryButton } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { updatePassword } from '../services/authService'

export default function ResetPassword() {
  const { isLoading, isAuthenticated, isDemo } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (pending) return
    if (password !== confirmation) {
      setError('As senhas precisam ser iguais.')
      return
    }
    setPending(true)
    setError('')
    try {
      const result = await updatePassword(password)
      if (result.error) throw result.error
      navigate('/home', { replace: true })
    } catch {
      setError(
        'Não foi possível alterar a senha. Solicite um novo link e tente novamente.',
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] bg-mist px-6 py-10">
      <BrandMark compact />
      <h1 className="mt-10 text-2xl font-semibold">Nova senha</h1>
      {isLoading ? (
        <p role="status" className="mt-6">
          Confirmando seu link...
        </p>
      ) : !isAuthenticated || isDemo ? (
        <div className="mt-6 space-y-4">
          <p>Este link expirou ou não é válido.</p>
          <Link
            to="/login"
            className="inline-block font-semibold text-soma-600"
          >
            Solicitar outro link pelo login
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <FormField
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending}
          />
          <FormField
            label="Confirme a senha"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={pending}
          />
          <Feedback error={error} />
          <PrimaryButton disabled={pending} type="submit">
            {pending ? 'Salvando...' : 'Salvar senha'}
          </PrimaryButton>
        </form>
      )}
    </main>
  )
}
