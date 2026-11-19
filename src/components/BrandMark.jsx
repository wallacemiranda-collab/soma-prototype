import { brand } from '../config/brand'

export default function BrandMark({ compact = false, inverse = false }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5" role="img" aria-label={brand.name}>
      <img
        src="/endo-plus-symbol.svg"
        alt=""
        aria-hidden="true"
        width="80"
        height="80"
        className={`${compact ? 'h-11 w-11' : 'h-16 w-16'} ${
          inverse ? 'rounded-full bg-white/95 p-1' : ''
        }`}
      />
      <div aria-hidden="true">
        <div
          className={`${compact ? 'text-[1.75rem]' : 'text-[2.5rem]'} flex items-center gap-1.5 font-semibold leading-none tracking-[-0.055em] ${
            inverse ? 'text-white' : 'text-soma-900'
          }`}
        >
          {brand.wordmark}
          <span className={inverse ? 'text-soma-200' : 'text-soma-500'}>+</span>
        </div>
        {!compact && (
          <p className={`mt-2 text-xs tracking-normal ${inverse ? 'text-soma-100' : 'text-soma-600'}`}>
            {brand.tagline}
          </p>
        )}
      </div>
    </div>
  )
}
