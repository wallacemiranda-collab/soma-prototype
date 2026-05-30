import {
  Bell,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Flame,
  LogOut,
  ShieldCheck,
  Target,
  Trophy,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import MetabolicCard from '../components/MetabolicCard'
import { achievements, profileOptions, user } from '../data/mockData'
import { SectionTitle } from '../components/ui'

const icons = { Bell, BookOpen, CircleHelp, ShieldCheck, Target, Trophy, Flame }

export default function Profile() {
  return (
    <>
      <AppHeader title="Perfil" simple />

      <section className="flex flex-col items-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-soma-800 text-2xl font-semibold text-white">
          {user.avatar}
        </div>
        <h2 className="mt-4 text-xl font-semibold">Marina Alves</h2>
        <p className="text-sm text-soma-500">marina@soma.app</p>
        <span className="mt-3 rounded-full bg-soma-100 px-4 py-1.5 text-xs font-semibold text-soma-700">
          {user.level}
        </span>
      </section>

      <div className="mt-7">
        <SectionTitle title="Conquistas" />
        <div className="hide-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
          {achievements.map(({ title, description, icon }) => {
            const Icon = icons[icon]
            return (
              <MetabolicCard key={title} className="w-36 shrink-0 !p-4">
                <Icon className="h-6 w-6 text-sun" />
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-xs text-soma-500">{description}</p>
              </MetabolicCard>
            )
          })}
        </div>
      </div>

      <MetabolicCard className="mt-6 space-y-1 !px-4 !py-2">
        {profileOptions.map(({ label, detail, icon }) => {
          const Icon = icons[icon]
          return (
            <button key={label} className="flex w-full items-center gap-3 border-b border-soma-50 py-3.5 text-left last:border-0">
              <Icon className="h-5 w-5 text-soma-600" />
              <span className="flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-soma-500">{detail}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-soma-300" />
            </button>
          )
        })}
      </MetabolicCard>

      <Link
        to="/login"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-semibold text-rose"
      >
        <LogOut className="h-5 w-5" />
        Sair da conta
      </Link>
    </>
  )
}
