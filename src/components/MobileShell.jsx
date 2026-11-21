import { motion } from 'framer-motion'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import BottomNavigation from './BottomNavigation'
import BrandMark from './BrandMark'
import { brand } from '../config/brand'
import { PatientProvider } from '../contexts/PatientContext'
import { useAuth } from '../contexts/AuthContext'
import PatientState from './PatientState'
import { ClinicalPreviewProvider } from '../contexts/ClinicalPreviewContext'

export default function MobileShell() {
  const { user, isDemo } = useAuth()
  return (
    <PatientProvider key={`${user.id}:${isDemo}`}>
      <ClinicalPreviewProvider>
        <ShellContent />
      </ClinicalPreviewProvider>
    </PatientProvider>
  )
}

function ShellContent() {
  const { pathname } = useLocation()
  const { isDemo, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="app-backdrop min-h-dvh">
      <main className="mx-auto min-h-dvh max-w-[430px] bg-mist px-5 pb-28 pt-6 shadow-2xl shadow-soma-800/5">
        <Link
          to="/home"
          className="mb-6 inline-flex rounded-xl"
          aria-label={`${brand.name}, ir para o início`}
        >
          <BrandMark compact />
        </Link>
        {isDemo && (
          <div className="mb-6 rounded-xl border border-soma-200 bg-soma-100 p-3 text-sm text-soma-800">
            <p className="font-semibold">Demonstração · dados fictícios</p>
            <p className="mt-1 text-xs">
              Use apenas dados fictícios. A simulação fica nesta aba e não é
              enviada ao serviço. Não informe dados reais.
            </p>
            <button
              className="mt-2 py-1 font-semibold"
              onClick={async () => {
                await signOut()
                navigate('/login', { replace: true })
              }}
            >
              Ir para o login
            </button>
          </div>
        )}
        <PatientState>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </PatientState>
      </main>
      <BottomNavigation />
    </div>
  )
}
