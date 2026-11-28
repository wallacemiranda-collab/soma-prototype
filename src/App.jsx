import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import MobileShell from './components/MobileShell'
import ProtectedRoute from './components/ProtectedRoute'
import ScrollToTop from './components/ScrollToTop'
import { brand } from './config/brand'
import { AuthProvider } from './contexts/AuthContext'
import Education from './screens/Education'
import Evolution from './screens/Evolution'
import Habits from './screens/Habits'
import Home from './screens/Home'
import Landing from './screens/Landing'
import Login from './screens/Login'
import Pricing from './screens/Pricing'
import Profile from './screens/Profile'
import Splash from './screens/Splash'
import PatientEntry from './screens/PatientEntry'
import AuthCallback from './screens/AuthCallback'
import ResetPassword from './screens/ResetPassword'
import Sharing from './screens/Sharing'
import DoctorShell from './components/DoctorShell'
import DoctorDashboard from './screens/DoctorDashboard'
import DoctorPatient from './screens/DoctorPatient'
import HomologationBoundary from './components/HomologationBoundary'
import Phase3PreviewBoundary from './components/Phase3PreviewBoundary'
import { Phase3PwaProvider } from './contexts/Phase3PwaContext'
import { phase3Preview } from './config/phase3Preview'
import InstallPreview from './screens/InstallPreview'
import ReminderPreview from './screens/ReminderPreview'
import { homologationEnabled } from './config/homologation'
import { calculatorsEnabled, patientCalculatorsEnabled } from './config/calculators.js'
import { glp1TreatmentVisible } from './config/phase10.js'
import { deviceImportVisible } from './config/deviceImport.js'
import { cgmPilotEnabled } from './config/cgmPilot.js'
import {
  ClinicalDoctorPreview,
  ClinicalHub,
  ClinicalModuleScreen,
} from './screens/ClinicalPreview'
import {
  ClinicalDoctorWorkspace,
  ClinicalPatientWorkspace,
} from './screens/ClinicalWorkspace'

const DoctorCalculator = lazy(() => import('./screens/DoctorCalculator'))
const PatientCalculators = lazy(() => import('./screens/PatientCalculators'))
const IntegrationsEntry = lazy(() => import('./screens/IntegrationsEntry'))
const CgmDoctorPatientPilot = lazy(() => import('./screens/CgmDoctorPatientPilot'))

export default function App() {
  useEffect(() => {
    document.title = `${phase3Preview.requested ? '[Prévia Fase 3] ' : homologationEnabled ? '[Prévia] ' : ''}${brand.siteTitle}`
    if (!homologationEnabled && !phase3Preview.requested) return
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow, noarchive'
    document.head.append(robots)
    return () => robots.remove()
  }, [])

  return (
    <Phase3PreviewBoundary>
      <Phase3PwaProvider>
        <HomologationBoundary>
          <AuthProvider>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/splash" element={<Splash />} />
              <Route path="/planos" element={<Pricing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/redefinir-senha" element={<ResetPassword />} />
              {phase3Preview.allowed && (
                <Route path="/instalar" element={<InstallPreview />} />
              )}
              <Route element={<ProtectedRoute />}>
                <Route element={<MobileShell />}>
                  <Route path="/home" element={<Home />} />
                  <Route path="/evolucao" element={<Evolution />} />
                  <Route path="/habitos" element={<Habits />} />
                  {(glp1TreatmentVisible || deviceImportVisible || cgmPilotEnabled) && (
                    <Route
                      path="/integracoes"
                      element={
                        <Suspense fallback={<p role="status">Carregando...</p>}>
                          <IntegrationsEntry />
                        </Suspense>
                      }
                    />
                  )}
                  <Route path="/educacao" element={<Education />} />
                  <Route path="/perfil" element={<Profile />} />
                  <Route path="/registro" element={<PatientEntry />} />
                  <Route path="/compartilhar" element={<Sharing />} />
                  {patientCalculatorsEnabled && (
                    <Route
                      path="/calculadoras"
                      element={
                        <Suspense fallback={<p role="status">Carregando...</p>}>
                          <PatientCalculators />
                        </Suspense>
                      }
                    />
                  )}
                  {phase3Preview.allowed && (
                    <Route path="/lembretes" element={<ReminderPreview />} />
                  )}
                  <Route path="/modulos" element={<ClinicalHub />} />
                  <Route
                    path="/modulos/:moduleId"
                    element={<ClinicalModuleScreen />}
                  />
                  <Route
                    path="/previa/medico"
                    element={<ClinicalDoctorPreview />}
                  />
                  <Route
                    path="/cuidados"
                    element={<ClinicalPatientWorkspace />}
                  />
                </Route>
                <Route element={<DoctorShell />}>
                  {cgmPilotEnabled && (
                    <Route
                      path="/profissional/pacientes/:patientId/integracoes"
                      element={
                        <Suspense fallback={<p role="status">Carregando...</p>}>
                          <CgmDoctorPatientPilot />
                        </Suspense>
                      }
                    />
                  )}
                  {calculatorsEnabled && (
                    <Route
                      path="/profissional/pacientes/:patientId/calculadoras"
                      element={
                        <Suspense fallback={<p role="status">Carregando...</p>}>
                          <DoctorCalculator />
                        </Suspense>
                      }
                    />
                  )}
                  <Route
                    path="/profissional/pacientes/:patientId/cuidados"
                    element={<ClinicalDoctorWorkspace />}
                  />
                  <Route path="/profissional" element={<DoctorDashboard />} />
                  <Route
                    path="/profissional/pacientes/:patientId"
                    element={<DoctorPatient />}
                  />
                  <Route path="/medico" element={<DoctorDashboard />} />
                  <Route
                    path="/medico/pacientes/:patientId"
                    element={<DoctorPatient />}
                  />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </HomologationBoundary>
      </Phase3PwaProvider>
    </Phase3PreviewBoundary>
  )
}
