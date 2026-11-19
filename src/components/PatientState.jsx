import { useState } from 'react'
import { usePatient } from '../contexts/PatientContext'
import { useAuth } from '../contexts/AuthContext'

export default function PatientState({ children }) {
  const { isLoading, error, reload } = usePatient()
  const { signOut } = useAuth()
  const [leaving, setLeaving] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  async function leave() {
    setLeaving(true)
    setLogoutError('')
    try {
      const result = await signOut()
      if (result.error) throw result.error
    } catch {
      setLogoutError(
        'Não foi possível sair. Confira sua conexão e tente novamente.',
      )
    } finally {
      setLeaving(false)
    }
  }
  if (isLoading)
    return (
      <p role="status" className="py-12 text-center text-soma-600">
        Carregando seus registros...
      </p>
    )
  if (error)
    return (
      <div role="alert" className="rounded-2xl bg-white p-5 text-soma-900">
        <p>{error}</p>
        {logoutError && <p className="mt-3 text-sm">{logoutError}</p>}
        <button
          type="button"
          onClick={reload}
          className="mt-4 font-semibold text-soma-600"
        >
          Tentar novamente
        </button>
        <button
          type="button"
          disabled={leaving}
          onClick={leave}
          className="mt-4 block py-2 text-sm font-semibold text-soma-600 disabled:opacity-50"
        >
          {leaving ? 'Saindo...' : 'Sair da conta'}
        </button>
      </div>
    )
  return children
}
