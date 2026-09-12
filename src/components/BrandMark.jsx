import { brand } from '../config/brand'

export default function BrandMark({ compact = false, inverse = false }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex items-center justify-center rounded-2xl ${
          compact ? 'h-10 w-10' : 'h-16 w-16'
        } ${inverse ? 'bg-white/15' : 'bg-soma-800'}`}
      >
        <span className={`${compact ? 'text-2xl' : 'text-4xl'} font-semibold text-white`}>
          {brand.initial}
        </span>
      </div>
      <div>
        <div
          className={`${compact ? 'text-xl' : 'text-3xl'} font-semibold tracking-[0.18em] ${
            inverse ? 'text-white' : 'text-soma-900'
          }`}
        >
          {brand.name}
        </div>
        {!compact && (
          <p className={`mt-1 text-sm ${inverse ? 'text-soma-200' : 'text-soma-600'}`}>
            {brand.tagline}
          </p>
        )}
      </div>
    </div>
  )
}
