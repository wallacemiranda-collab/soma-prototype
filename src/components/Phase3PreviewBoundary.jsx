import { phase3Preview } from '../config/phase3Preview'

export default function Phase3PreviewBoundary({ children }) {
  if (!phase3Preview.requested) return children
  if (!phase3Preview.allowed)
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-2xl font-semibold">Prévia bloqueada</h1>
        <p className="mt-4">
          A Fase 3 deve usar um endereço separado, sem conexão com contas ou
          serviços de dados reais.
        </p>
      </main>
    )
  return (
    <>
      <aside
        aria-label="Prévia da Fase 3"
        className="bg-soma-900 px-5 py-3 text-center text-sm text-white"
      >
        <p className="font-semibold">Prévia da Fase 3 · somente demonstração</p>
        <p className="mt-1 text-xs">
          Sem contas reais, notificações ou mudanças no serviço oficial.
        </p>
      </aside>
      {children}
    </>
  )
}
