import { Sparkles } from 'lucide-react'
import MetabolicCard from './MetabolicCard'

export default function AIInsightCard({ children }) {
  return (
    <MetabolicCard className="!bg-soma-50 !p-4">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-white p-2 text-soma-600">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-soma-500">
            Insight SOMA
          </p>
          <p className="mt-1 text-sm leading-5 text-soma-800">{children}</p>
        </div>
      </div>
    </MetabolicCard>
  )
}
