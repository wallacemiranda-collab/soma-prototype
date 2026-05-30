export default function EvolutionGraph({ points }) {
  const coordinates = points.map((point, index) => `${index * 50 + 8},${106 - point.value}`).join(' ')

  return (
    <div>
      <svg viewBox="0 0 316 114" className="h-28 w-full" aria-label="Evolução nas últimas semanas">
        <defs>
          <linearGradient id="graphFill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#197c79" stopOpacity=".2" />
            <stop offset="1" stopColor="#197c79" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M ${coordinates} L 308 110 L 8 110 Z`} fill="url(#graphFill)" />
        <polyline
          points={coordinates}
          fill="none"
          stroke="#197c79"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <circle key={`${point.day}-${index}`} cx={index * 50 + 8} cy={106 - point.value} r="4" fill="#197c79" />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-soma-500">
        {points.map((point, index) => (
          <span key={`${point.day}-${index}`}>{point.day}</span>
        ))}
      </div>
    </div>
  )
}
