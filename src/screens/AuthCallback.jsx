import { Link, Navigate, useLocation } from 'react-router-dom'
import BrandMark from '../components/BrandMark'
import { useAuth } from '../contexts/AuthContext'

export default function AuthCallback() {
  const { isLoading, isAuthenticated, isDemo, accessMode } = useAuth()
  const location = useLocation()
  const failed =
    new URLSearchParams(location.search).has('error') ||
    new URLSearchParams(location.hash.slice(1)).has('error')
  if (!failed && isLoading)
    return (
      <p role="status" className="p-10 text-center text-soma-600">
        Confirmando seu acesso...
      </p>
    )
  if (!failed && isAuthenticated && !isDemo)
    return (
      <Navigate to={accessMode === 'doctor' ? '/medico' : '/home'} replace />
    )
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] bg-mist px-6 py-10">
      <BrandMark compact />
      <h1 className="mt-10 text-2xl font-semibold">Confira seu acesso</h1>
      <p className="mt-4 text-soma-600">
        O link não pôde ser confirmado. Se você já confirmou seu e-mail, entre
        com sua senha. Caso contrário, solicite um novo cadastro ou link.
      </p>
      <Link
        to="/login"
        className="mt-6 inline-block font-semibold text-soma-600"
      >
        Voltar ao login
      </Link>
    </main>
  )
}
