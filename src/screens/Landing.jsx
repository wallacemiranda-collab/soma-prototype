import { ArrowRight, CheckCircle2, HeartPulse, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import BrandMark from '../components/BrandMark'

const benefits = [
  {
    icon: HeartPulse,
    title: 'Acompanhamento contínuo',
    description: 'Peso, sono, atividade e hábitos em uma jornada simples de acompanhar.',
  },
  {
    icon: Sparkles,
    title: 'Insights personalizados',
    description: 'Leituras claras sobre consistência, evolução e próximos passos.',
  },
  {
    icon: TrendingUp,
    title: 'Evolução visível',
    description: 'Linha do tempo metabólica para mostrar progresso sem depender só da balança.',
  },
]

const proofPoints = ['Protótipo navegável', 'Dados simulados', 'Pronto para pilotos comerciais']

export default function Landing() {
  return (
    <div className="app-backdrop min-h-dvh">
      <main className="mx-auto min-h-dvh max-w-[430px] overflow-hidden bg-mist text-soma-900 shadow-2xl shadow-soma-800/5">
        <section className="relative bg-soma-900 px-6 pb-9 pt-8 text-white">
          <div className="absolute -right-24 top-10 h-56 w-56 rounded-full bg-soma-400/20" />
          <div className="absolute -left-28 bottom-10 h-56 w-56 rounded-full bg-sun/20" />

          <div className="relative flex items-center justify-between">
            <BrandMark compact inverse />
            <Link
              to="/login"
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur"
            >
              Entrar
            </Link>
          </div>

          <div className="relative mt-14">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-soma-300">
              Saúde metabólica como serviço
            </p>
            <h1 className="mt-4 text-[2.65rem] font-semibold leading-[1.02] tracking-tight">
              O cuidado metabólico que continua entre consultas.
            </h1>
            <p className="mt-5 text-base leading-7 text-soma-100">
              SOMA ajuda pacientes e profissionais a transformar dados, hábitos e educação em uma
              jornada contínua, humana e motivadora.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 font-semibold text-soma-900"
              >
                Começar
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/planos"
                className="flex items-center justify-center rounded-2xl border border-white/20 px-5 py-4 font-semibold text-white"
              >
                Ver planos
              </Link>
            </div>
          </div>
        </section>

        <section className="px-6 py-7">
          <div className="grid grid-cols-3 gap-3">
            {proofPoints.map((item) => (
              <div key={item} className="rounded-2xl bg-white p-3 text-center shadow-card">
                <CheckCircle2 className="mx-auto h-5 w-5 text-soma-500" />
                <p className="mt-2 text-xs font-semibold leading-4 text-soma-700">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-6 pb-8">
          <h2 className="text-2xl font-semibold tracking-tight">Por que agora?</h2>
          <p className="mt-3 text-sm leading-6 text-soma-600">
            O mercado precisa de cuidado preventivo, recorrente e mensurável. SOMA nasce para
            conectar comportamento, dados e orientação em uma experiência pronta para pilotos.
          </p>

          <div className="mt-6 space-y-4">
            {benefits.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-[1.5rem] bg-white p-5 shadow-card">
                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-soma-100 text-soma-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-soma-900">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-soma-600">{description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="px-6 pb-9">
          <div className="rounded-[1.75rem] bg-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sun/20 text-[#9a6a18]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-soma-900">Próximo passo comercial</h2>
                <p className="text-sm text-soma-600">Validar pilotos, planos e onboarding.</p>
              </div>
            </div>
            <Link
              to="/planos"
              className="mt-5 flex w-full items-center justify-center rounded-2xl bg-soma-800 px-5 py-4 font-semibold text-white"
            >
              Estruturar oferta
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
