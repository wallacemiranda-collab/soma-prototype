import { ArrowLeft, Check, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import BrandMark from '../components/BrandMark'

const plans = [
  {
    name: 'Essencial',
    price: 'R$ 49',
    description: 'Para pacientes acompanharem hábitos e evolução metabólica.',
    features: ['Dashboard pessoal', 'Hábitos e sono', 'Educação guiada'],
  },
  {
    name: 'Acompanhamento',
    price: 'R$ 149',
    description: 'Para jornada assistida com mais contexto e revisões periódicas.',
    featured: true,
    features: ['Tudo do Essencial', 'Insights prioritários', 'Relatório mensal'],
  },
  {
    name: 'Clínicas',
    price: 'Sob consulta',
    description: 'Para profissionais acompanharem grupos de pacientes.',
    features: ['Piloto comercial', 'Painel profissional', 'Implantação guiada'],
  },
]

export default function Pricing() {
  return (
    <div className="app-backdrop min-h-dvh">
      <main className="mx-auto min-h-dvh max-w-[430px] bg-mist px-6 pb-10 pt-8 text-soma-900 shadow-2xl shadow-soma-800/5">
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-soma-700 shadow-card"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <BrandMark compact />
        </header>

        <section className="mt-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-soma-500">
            Oferta comercial
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Planos simples para iniciar pilotos reais.
          </h1>
          <p className="mt-3 text-sm leading-6 text-soma-600">
            Valores de validação. A cobrança real ainda deve ser conectada depois com Stripe,
            Mercado Pago ou outro provedor.
          </p>
        </section>

        <section className="mt-7 space-y-4">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-[1.5rem] p-5 shadow-card ${
                plan.featured ? 'bg-soma-900 text-white' : 'bg-white text-soma-900'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{plan.name}</h2>
                  <p className={`mt-2 text-sm leading-6 ${plan.featured ? 'text-soma-100' : 'text-soma-600'}`}>
                    {plan.description}
                  </p>
                </div>
                {plan.featured && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                    Piloto
                  </span>
                )}
              </div>

              <p className="mt-5 text-3xl font-semibold">
                {plan.price}
                {plan.price.startsWith('R$') && <span className="text-sm font-medium">/mês</span>}
              </p>

              <ul className="mt-5 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${
                        plan.featured ? 'bg-white/10 text-white' : 'bg-soma-100 text-soma-700'
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                to="/login"
                className={`mt-6 flex w-full items-center justify-center rounded-2xl px-5 py-4 font-semibold ${
                  plan.featured ? 'bg-white text-soma-900' : 'bg-soma-800 text-white'
                }`}
              >
                Quero testar
              </Link>
            </article>
          ))}
        </section>

        <section className="mt-7 rounded-[1.5rem] bg-white p-5 shadow-card">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-soma-100 text-soma-700">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Quer vender como piloto?</h2>
              <p className="mt-1 text-sm leading-6 text-soma-600">
                Comece com lista de espera, triagem manual e acompanhamento simples antes de
                automatizar pagamentos e prontuário.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
