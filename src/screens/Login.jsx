import { Chrome, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import BrandMark from '../components/BrandMark'
import { Feedback, FormField, PrimaryButton } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import {
  isGoogleAuthEnabled,
  isSupabaseConfigured,
} from '../lib/supabaseClient'
import { requestPasswordReset } from '../services/authService'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    signIn,
    signUp,
    signInGoogle,
    startDemo,
    isDemo,
    isAuthenticated,
    isLoading,
  } = useAuth()
  const [mode, setMode] = useState(() =>
    new URLSearchParams(location.search).get('modo') === 'cadastro'
      ? 'signup'
      : 'signin',
  )
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const requested = location.state?.from?.pathname
  const destination = [
    '/home',
    '/evolucao',
    '/habitos',
    '/educacao',
    '/perfil',
    '/registro',
  ].includes(requested)
    ? requested
    : '/home'

  if (!isLoading && isAuthenticated)
    return <Navigate to={isDemo ? '/home' : destination} replace />

  function changeMode(next) {
    setMode(next)
    setError('')
    setMessage('')
    setPassword('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (pending || !isSupabaseConfigured) return
    setError('')
    setMessage('')
    setPending(true)
    try {
      const result =
        mode === 'signup'
          ? await signUp(email, password, name)
          : mode === 'forgot'
            ? await requestPasswordReset(email)
            : await signIn(email, password)
      if (result.error) throw result.error
      if (mode === 'forgot') {
        setMessage(
          'Se houver uma conta com este e-mail, você receberá um link para redefinir a senha.',
        )
        return
      }
      if (result.needsEmailConfirmation) {
        changeMode('signin')
        setMessage(
          'Confira seu e-mail para confirmar o cadastro. Depois, entre com sua senha.',
        )
        return
      }
      navigate(destination, { replace: true })
    } catch {
      setError('Não foi possível concluir. Confira os dados e tente novamente.')
    } finally {
      setPending(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setPending(true)
    try {
      const result = await signInGoogle()
      if (result.error) throw result.error
    } catch {
      setError('Não foi possível conectar ao Google. Tente novamente.')
      setPending(false)
    }
  }

  return (
    <div className="app-backdrop min-h-dvh">
      <main className="mx-auto min-h-dvh max-w-[430px] bg-mist px-6 pb-10 pt-8">
        <Link to="/" className="inline-flex rounded-xl">
          <BrandMark compact />
        </Link>
        <h1 className="mt-10 text-3xl font-semibold text-soma-900">
          {mode === 'signup'
            ? 'Crie sua conta'
            : mode === 'forgot'
              ? 'Recuperar acesso'
              : 'Seu cuidado continua aqui'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-soma-600">
          {mode === 'forgot'
            ? 'Informe o e-mail da sua conta para receber um link de recuperação.'
            : 'Entre para registrar sua rotina e acompanhar sua evolução.'}
        </p>
        {!isSupabaseConfigured && (
          <p
            role="status"
            className="mt-6 rounded-2xl bg-soma-100 p-4 text-sm text-soma-800"
          >
            O acesso às contas ainda não está disponível. Por enquanto, você
            pode conhecer a demonstração com dados fictícios.
          </p>
        )}
        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {mode === 'signup' && (
            <FormField
              label="Nome completo"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
              maxLength={100}
              disabled={pending || !isSupabaseConfigured}
            />
          )}
          <FormField
            label="E-mail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            disabled={pending || !isSupabaseConfigured}
          />
          {mode !== 'forgot' && (
            <div>
              <FormField
                label="Senha"
                type={visible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === 'signup' ? 'new-password' : 'current-password'
                }
                minLength={mode === 'signup' ? 8 : undefined}
                required
                disabled={pending || !isSupabaseConfigured}
              />
              <button
                type="button"
                onClick={() => setVisible(!visible)}
                aria-pressed={visible}
                className="mt-2 flex items-center gap-2 py-1 text-xs text-soma-600"
              >
                {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                {visible ? 'Ocultar senha' : 'Mostrar senha'}
              </button>
              {mode === 'signup' && (
                <p className="mt-2 text-xs text-soma-600">
                  Use pelo menos 8 caracteres.
                </p>
              )}
            </div>
          )}
          <Feedback error={error} message={message} />
          <PrimaryButton
            type="submit"
            disabled={pending || isLoading || !isSupabaseConfigured}
          >
            {pending
              ? 'Aguarde...'
              : mode === 'signup'
                ? 'Criar conta'
                : mode === 'forgot'
                  ? 'Enviar link'
                  : 'Entrar'}
          </PrimaryButton>
        </form>
        {mode === 'signin' && (
          <button
            onClick={() => changeMode('forgot')}
            className="mt-4 w-full py-2 text-center text-sm font-semibold text-soma-600"
          >
            Esqueci minha senha
          </button>
        )}
        {isGoogleAuthEnabled && (
          <button
            type="button"
            onClick={handleGoogle}
            disabled={pending || isLoading}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-soma-200 bg-white py-4 font-semibold text-soma-800 disabled:opacity-50"
          >
            <Chrome size={20} />
            Continuar com Google
          </button>
        )}
        <p className="mt-7 text-center text-sm text-soma-600">
          {mode === 'signin' ? 'Ainda não tem conta? ' : 'Já tem conta? '}
          <button
            disabled={pending}
            onClick={() => changeMode(mode === 'signin' ? 'signup' : 'signin')}
            className="py-2 font-semibold text-soma-800"
          >
            {mode === 'signin' ? 'Criar conta' : 'Entrar'}
          </button>
        </p>
        <div className="mt-7 border-t border-soma-100 pt-6 text-center">
          <button
            disabled={pending || isLoading}
            onClick={() => {
              startDemo()
              navigate('/home', { replace: true })
            }}
            className="py-2 font-semibold text-soma-600 disabled:opacity-50"
          >
            Explorar demonstração
          </button>
          <p className="mt-1 text-xs text-soma-600">
            Dados fictícios. Nenhum cadastro necessário.
          </p>
        </div>
      </main>
    </div>
  )
}
