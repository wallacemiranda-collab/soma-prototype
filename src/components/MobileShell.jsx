import { motion } from 'framer-motion'
import { Link, Outlet } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import BottomNavigation from './BottomNavigation'
import BrandMark from './BrandMark'
import { brand } from '../config/brand'

export default function MobileShell() {
  const { pathname } = useLocation()

  return (
    <div className="app-backdrop min-h-dvh">
      <main className="mx-auto min-h-dvh max-w-[430px] bg-mist px-5 pb-28 pt-6 shadow-2xl shadow-soma-800/5">
        <Link to="/home" className="mb-6 inline-flex rounded-xl" aria-label={`${brand.name}, ir para o início`}>
          <BrandMark compact />
        </Link>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.div>
      </main>
      <BottomNavigation />
    </div>
  )
}
