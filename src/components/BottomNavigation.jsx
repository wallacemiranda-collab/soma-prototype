import {
  Calculator,
  BookOpen,
  Activity,
  ChartNoAxesColumnIncreasing,
  House,
  Leaf,
  UserRound,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { glp1TreatmentVisible } from '../config/phase10.js'
import { deviceImportVisible } from '../config/deviceImport.js'

const patientItems = [
  { path: '/home', label: 'Início', icon: House },
  { path: '/evolucao', label: 'Evolução', icon: ChartNoAxesColumnIncreasing },
  { path: '/habitos', label: 'Hábitos', icon: Leaf },
  { path: '/educacao', label: 'Educação', icon: BookOpen },
  { path: '/perfil', label: 'Perfil', icon: UserRound },
]

const calculatorItem = {
  path: '/calculadoras',
  label: 'Cálculos',
  icon: Calculator,
}

const integrationsItem = {
  path: '/integracoes',
  label: 'Integrações',
  icon: Activity,
}

export default function BottomNavigation() {
  return (
    <nav
      aria-label="Navegação principal"
      className="safe-bottom fixed bottom-0 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 justify-around border-t border-soma-100 bg-white/95 px-2 pt-3 backdrop-blur"
    >
      {[...patientItems, calculatorItem, ...(glp1TreatmentVisible || deviceImportVisible ? [integrationsItem] : [])].map(
        ({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center gap-1 text-[11px] font-medium transition duration-200 ${
                isActive ? 'text-soma-500' : 'text-soma-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`rounded-xl p-1.5 ${isActive ? 'bg-soma-100' : ''}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.6 : 2} />
                </div>
                {label}
              </>
            )}
          </NavLink>
        ),
      )}
    </nav>
  )
}
