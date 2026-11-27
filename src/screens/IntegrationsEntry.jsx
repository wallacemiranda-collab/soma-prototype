import { lazy, Suspense } from 'react'
import AppHeader from '../components/AppHeader'
import MetabolicCard from '../components/MetabolicCard'
import { useAuth } from '../contexts/AuthContext'
import { cgmPilotEnabled } from '../config/cgmPilot.js'

const IntegrationsDemo = lazy(() => import('./IntegrationsPreview.jsx'))
const CgmPatientPilot = lazy(() => import('./CgmPatientPilot.jsx'))

export default function IntegrationsEntry() {
  const { isDemo } = useAuth()
  if (isDemo) return <Suspense fallback={<p role="status">Carregando...</p>}><IntegrationsDemo /></Suspense>
  if (cgmPilotEnabled) return <Suspense fallback={<p role="status">Carregando...</p>}><CgmPatientPilot /></Suspense>
  return (
    <>
      <AppHeader title="Integrações" subtitle="Indisponível neste ambiente" simple />
      <MetabolicCard>
        <p>Esta função não está habilitada aqui. A demonstração usa somente dados fictícios e o piloto exige ambiente de homologação autorizado.</p>
      </MetabolicCard>
    </>
  )
}
