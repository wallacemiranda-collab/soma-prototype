import { useEffect, useState } from 'react'
import {
  homologationEnabled,
  homologationProject,
} from '../config/homologation'
import { supabase } from '../lib/supabaseClient'

export default function HomologationBoundary({ children }) {
  if (!homologationEnabled) return children
  return <VerifiedEnvironment>{children}</VerifiedEnvironment>
}

function VerifiedEnvironment({ children }) {
  const [state, setState] = useState('loading')
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    async function verify() {
      try {
        if (!supabase) throw new Error('Invalid test configuration')
        const { data, error } = await supabase
          .rpc('endo_homologation_info')
          .abortSignal(controller.signal)
        if (
          error ||
          data?.project_id !== homologationProject ||
          data?.environment !== 'homologation' ||
          data?.synthetic_only !== true
        )
          throw new Error('Not homologation')
        if (active) setState('ready')
      } catch {
        if (active) setState('error')
      } finally {
        clearTimeout(timeout)
      }
    }
    verify()
    return () => {
      active = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [])
  return (
    <>
      <aside
        aria-label="Ambiente de testes"
        className="sticky top-0 z-50 border-b border-soma-200 bg-soma-900 px-4 py-3 text-white"
      >
        <div className="mx-auto max-w-4xl text-sm leading-5">
          <p className="font-semibold">Endo + · Prévia de homologação</p>
          <p>
            Somente dados fictícios. Não use sua conta real nem dados de
            pacientes. Esta versão não é o app oficial.
          </p>
        </div>
      </aside>
      {state === 'ready' ? (
        children
      ) : (
        <main className="mx-auto max-w-md px-5 py-10">
          {state === 'loading' ? (
            <p role="status">Confirmando o ambiente de testes...</p>
          ) : (
            <div role="alert">
              <h1 className="text-xl font-semibold">Prévia indisponível</h1>
              <p className="mt-3">
                Não foi possível confirmar o ambiente separado. Nenhum acesso às
                contas foi liberado.
              </p>
              <button
                className="mt-4 py-3 font-semibold text-soma-700"
                onClick={() => window.location.reload()}
              >
                Tentar novamente
              </button>
            </div>
          )}
        </main>
      )}
    </>
  )
}
