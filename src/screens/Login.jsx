import { Apple, Eye, LockKeyhole, Mail } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import BrandMark from '../components/BrandMark'
import { PrimaryButton } from '../components/ui'

export default function Login() {
  const navigate = useNavigate()

  function handleSubmit(event) {
    event.preventDefault()
    navigate('/home')
  }

  return (
    <div className="app-backdrop min-h-dvh">
      <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-mist px-6 pb-8 pt-11">
        <BrandMark compact />

        <section className="mt-14">
          <h1 className="text-3xl font-semibold tracking-tight text-soma-900">Bem-vinda de volta</h1>
          <p className="mt-2 text-sm leading-6 text-soma-600">
            Entre para acompanhar sua evolução metabólica.
          </p>
        </section>

        <form className="mt-10 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-soma-800">
            E-mail
            <span className="mt-2 flex items-center gap-3 rounded-2xl border border-soma-100 bg-white px-4 py-4 text-soma-400">
              <Mail className="h-5 w-5" />
              <input
                type="email"
                defaultValue="marina@soma.app"
                className="w-full bg-transparent text-soma-900 outline-none"
                aria-label="E-mail"
              />
            </span>
          </label>
          <label className="block text-sm font-medium text-soma-800">
            Senha
            <span className="mt-2 flex items-center gap-3 rounded-2xl border border-soma-100 bg-white px-4 py-4 text-soma-400">
              <LockKeyhole className="h-5 w-5" />
              <input
                type="password"
                defaultValue="soma1234"
                className="w-full bg-transparent text-soma-900 outline-none"
                aria-label="Senha"
              />
              <Eye className="h-5 w-5" />
            </span>
          </label>
          <button type="button" className="block w-full pb-2 text-right text-sm font-semibold text-soma-600">
            Esqueci minha senha
          </button>
          <PrimaryButton type="submit">Entrar</PrimaryButton>
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
          Ainda não tem conta?{' '}
          <Link className="font-semibold text-soma-800" to="/home">
            Criar conta
          </Link>
        </p>
      </main>
    </div>
  )
}
