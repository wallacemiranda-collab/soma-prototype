import { ArrowLeft, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import BrandMark from '../components/BrandMark'
import { brand } from '../config/brand'

export default function Pricing() {
  return (
    <div className="app-backdrop min-h-dvh">
      <main className="mx-auto min-h-dvh max-w-[430px] bg-mist px-6 py-8">
        <header className="flex items-center justify-between">
          <Link
            to="/"
            aria-label="Voltar"
            className="rounded-xl bg-white p-3 text-soma-700"
          >
            <ArrowLeft size={20} />
          </Link>
          <BrandMark compact />
        </header>
        <p className="mt-10 text-sm font-semibold uppercase tracking-widest text-soma-600">
          Piloto para pacientes
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-soma-900">
          Um lugar para acompanhar sua rotina.
        </h1>
        <p className="mt-4 text-sm leading-6 text-soma-600">
          O Endo + está começando com um piloto. Os planos e as condições de
          acompanhamento serão definidos com a clínica.
        </p>
        <section className="mt-7 rounded-3xl bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold">O que você pode fazer</h2>
          <ul className="mt-5 space-y-4">
            {[
              'Criar sua conta e editar seu perfil',
              'Registrar medidas e hábitos por dia',
              'Revisar seu histórico pessoal',
              'Acessar o canal educativo do Dr. Wallace',
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-sm text-soma-700"
              >
                <Check size={18} className="shrink-0 text-soma-500" />
                {item}
              </li>
            ))}
          </ul>
          <Link
            to="/login?modo=cadastro"
            className="mt-7 flex justify-center rounded-2xl bg-soma-800 px-4 py-4 font-semibold text-white"
          >
            Criar minha conta
          </Link>
          <Link
            to="/login"
            className="mt-3 block py-3 text-center text-sm font-semibold text-soma-600"
          >
            Conhecer a demonstração
          </Link>
        </section>
        <a
          href={brand.clinic.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 block rounded-2xl border border-soma-100 bg-white p-5 text-sm font-semibold text-soma-600"
        >
          Conheça a {brand.clinic.name}
        </a>
      </main>
    </div>
  )
}
