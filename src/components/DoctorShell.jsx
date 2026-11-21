import { createContext, useContext, useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import BrandMark from './BrandMark'
import { Feedback } from './ui'
import { useAuth } from '../contexts/AuthContext'
import { sharingRepository } from '../services/sharingService'

const DoctorContext = createContext(null)
export const useDoctor = () => useContext(DoctorContext)

export default function DoctorShell() {
  const { user, isDemo } = useAuth()
  return <Workspace key={`${user.id}:${isDemo}`} />
}

function Workspace() {
  const { isDemo, signOut, setAccessMode } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    if (isDemo) {
      setLoading(false)
      return
    }
    setLoading(true)
    sharingRepository
      .loadDoctor()
      .then((value) => {
        if (active) {
          setProfile(value)
          setError('')
        }
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar a área profissional.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [isDemo, reload])
  async function leave() {
    setPending(true)
    setError('')
    try {
      const result = await signOut()
      if (result.error) throw result.error
      setAccessMode('doctor')
      navigate('/login?acesso=profissional', { replace: true })
    } catch {
      setError('Não foi possível sair. Tente novamente.')
      setPending(false)
    }
  }
  return (
    <div className="app-backdrop min-h-dvh">
      <main className="mx-auto min-h-dvh max-w-4xl bg-mist px-5 py-6 sm:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link to="/profissional" aria-label="Endo +, área profissional">
            <BrandMark compact />
          </Link>
          <nav
            aria-label="Navegação profissional"
            className="flex flex-wrap items-center gap-4 text-sm font-semibold text-soma-700"
          >
            <Link to="/profissional">Meus pacientes</Link>
            <Link to="/home" onClick={() => setAccessMode('patient')}>
              Área do paciente
            </Link>
            <button type="button" disabled={pending} onClick={leave}>
              {isDemo ? 'Entrar com minha conta' : 'Sair da conta'}
            </button>
          </nav>
        </header>
        {isDemo ? (
          <Feedback message="A demonstração não permite cadastro profissional nem acesso a pacientes. Entre com sua conta para continuar." />
        ) : loading ? (
          <p role="status">Carregando área profissional...</p>
        ) : error ? (
          <>
            <Feedback error={error} />
            <button
              type="button"
              onClick={() => setReload((value) => value + 1)}
              className="mt-4 font-semibold text-soma-700"
            >
              Tentar novamente
            </button>
          </>
        ) : (
          <DoctorContext.Provider value={{ profile, setProfile }}>
            <Outlet key={pathname} />
          </DoctorContext.Provider>
        )}
      </main>
    </div>
  )
}
