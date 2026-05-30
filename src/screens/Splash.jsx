import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import BrandMark from '../components/BrandMark'

export default function Splash() {
  return (
    <div className="app-backdrop min-h-dvh">
      <main className="relative mx-auto flex min-h-dvh max-w-[430px] flex-col overflow-hidden bg-soma-900 px-7 pb-9 pt-16 text-white">
        <div className="absolute -right-24 top-10 h-64 w-64 rounded-full bg-soma-500/20" />
        <div className="absolute -left-28 bottom-36 h-64 w-64 rounded-full bg-sun/20" />

        <motion.div
          className="relative"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <BrandMark inverse />
        </motion.div>

        <motion.div
          className="relative mt-auto"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-soma-300">
            Medicina metabólica longitudinal
          </p>
          <h1 className="text-[2.6rem] font-semibold leading-tight tracking-tight">
            Sua saúde,
            <br />
            em evolução.
          </h1>
          <p className="mt-5 max-w-[310px] text-base leading-7 text-soma-200">
            Hábitos, comportamento e acompanhamento contínuo em uma jornada sem culpa.
          </p>

          <Link
            to="/login"
            className="mt-10 flex w-full items-center justify-between rounded-2xl bg-white px-6 py-5 font-semibold text-soma-800"
          >
            Começar agora
            <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="mt-6 text-center text-xs text-soma-300">SOMA · Integrar para transformar vidas</p>
        </motion.div>
      </main>
    </div>
  )
}
