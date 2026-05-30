import { BookOpen, ChartNoAxesColumnIncreasing, House, Leaf, UserRound } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const items = [
  { path: '/home', label: 'Início', icon: House },
  { path: '/evolucao', label: 'Evolução', icon: ChartNoAxesColumnIncreasing },
  { path: '/habitos', label: 'Hábitos', icon: Leaf },
  { path: '/educacao', label: 'Educação', icon: BookOpen },
  { path: '/perfil', label: 'Perfil', icon: UserRound },
]

export default function BottomNavigation() {
  return (
    <nav className="safe-bottom fixed bottom-0 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 justify-around border-t border-soma-100 bg-white/95 px-2 pt-3 backdrop-blur">
      {items.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            `flex min-w-[64px] flex-col items-center gap-1 text-[11px] font-medium transition duration-200 ${
              isActive ? 'text-soma-700' : 'text-soma-300'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className={`rounded-xl p-1.5 ${isActive ? 'bg-soma-100' : ''}`}>
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.6 : 2} />
              </div>
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
