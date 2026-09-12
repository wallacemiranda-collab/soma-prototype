import { Apple, Eye, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import BrandMark from '../components/BrandMark'
import { PrimaryButton } from '../components/ui'
import { brand } from '../config/brand'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin')
  const [fullName, setFullName] = useState('Marina Alves')
  const [email, setEmail] = useState(brand.demoUser.email)
  const [password, setPassword] = useState(brand.demoUser.password)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isSignUp = mode === 'signup'
  const destination = location.state?.from?.pathname ?? '/home'

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    const result = isSignUp
      ? await signUp(email, password, fullName)
      : await signIn(email, password)

    setIsSubmitting(false)

    if (result.needsEmailConfirmation) {
      setErrorMessage('Conta criada. Confirme seu e-mail para entrar no SOMA.')
      return
    }

    if (result.error) {
      setErrorMessage(
        isSignUp
          ? 'Não foi possível criar sua conta. Confira os dados e tente novamente.'
          : 'Não foi possível entrar. Confira seu e-mail e senha.',
      )
      return
    }

    navigate(destination, { replace: true })
  }

  return (
    <div className="app-backdrop min-h-dvh">
      <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-mist px-6 pb-8 pt-11">
        <BrandMark compact />

        <section className="mt-14">
          <h1 className="text-3xl font-semibold tracking-tight text-soma-900">
            {isSignUp ? 'Crie sua conta' : 'Bem-vinda de volta'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-soma-600">
            {isSignUp
              ? 'Comece sua jornada metabólica com acompanhamento simples e contínuo.'
              : 'Entre para acompanhar sua evolução metabólica.'}
          </p>
        </section>

        <form className="mt-10 space-y-4" onSubmit={handleSubmit}>
          {isSignUp && (
            <label className="block text-sm font-medium text-soma-800">
              Nome
              <span className="mt-2 flex items-center gap-3 rounded-2xl border border-soma-100 bg-white px-4 py-4 text-soma-400">
                <UserRound className="h-5 w-5" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full bg-transparent text-soma-900 outline-none"
                  aria-label="Nome"
                  required
                />
              </span>
            </label>
          )}

          <label className="block text-sm font-medium text-soma-800">
            E-mail
            <span className="mt-2 flex items-center gap-3 rounded-2xl border border-soma-100 bg-white px-4 py-4 text-soma-400">
              <Mail className="h-5 w-5" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-transparent text-soma-900 outline-none"
                aria-label="E-mail"
                required
              />
            </span>
          </label>
          <label className="block text-sm font-medium text-soma-800">
            Senha
            <span className="mt-2 flex items-center gap-3 rounded-2xl border border-soma-100 bg-white px-4 py-4 text-soma-400">
              <LockKeyhole className="h-5 w-5" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-transparent text-soma-900 outline-none"
                aria-label="Senha"
                minLength={6}
                required
              />
              <Eye className="h-5 w-5" />
            </span>
          </label>
          {!isSignUp && (
            <button type="button" className="block w-full pb-2 text-right text-sm font-semibold text-soma-600">
              Esqueci minha senha
            </button>
          )}
          {errorMessage && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMessage}
            </p>
          )}
          <PrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? isSignUp
                ? 'Criando conta...'
                : 'Entrando...'
              : isSignUp
                ? 'Criar conta'
                : 'Entrar'}
          </PrimaryButton>
        </form>

        <div className="my-8 flex items-center gap-4 text-xs text-soma-400">
          <span className="h-px flex-1 bg-soma-100" />
          ou continue com
          <span className="h-px flex-1 bg-soma-100" />
        </div>
        <button className="flex w-full items-center justify-center gap-3 rounded-2xl border border-soma-100 bg-white py-4 font-semibold text-soma-800">
          <Apple className="h-5 w-5 fill-soma-800" />
          Continuar com Apple
        </button>
        <p className="mt-auto pt-10 text-center text-sm text-soma-600">
          {isSignUp ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
          <button
            type="button"
            className="font-semibold text-soma-800"
            onClick={() => {
              setErrorMessage('')
              setMode(isSignUp ? 'signin' : 'signup')
            }}
          >
            {isSignUp ? 'Entrar' : 'Criar conta'}
          </button>
        </p>
      </main>
    </div>
  )
}
