import { useId } from 'react'

export default function EvolutionGraph({
  points,
  label = 'Evolução dos registros',
}) {
  const gradient = useId()
  const min = Math.min(...points.map((point) => point.value))
  const max = Math.max(...points.map((point) => point.value))
  const position = (point, index) => ({
    x: points.length === 1 ? 158 : 8 + (index * 300) / (points.length - 1),
    y: max === min ? 57 : 102 - ((point.value - min) / (max - min)) * 90,
  })
  const coordinates = points
    .map((point, index) => {
      const { x, y } = position(point, index)
      return `${x},${y}`
    })
    .join(' ')
  if (!points.length)
    return <p className="text-sm text-soma-600">Ainda não há registros.</p>

  return (
    <div className="text-soma-500">
      <svg
        role="img"
        viewBox="0 0 316 114"
        className="h-28 w-full"
        aria-label={label}
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="currentColor" stopOpacity=".2" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {points.length > 1 && (
          <path
            d={`M ${coordinates} L 308 110 L 8 110 Z`}
            fill={`url(#${gradient})`}
          />
        )}
        <polyline
          points={coordinates}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <circle
            key={`${point.day}-${index}`}
            cx={position(point, index).x}
            cy={position(point, index).y}
            r="4"
            fill="currentColor"
          />
        ))}
      </svg>
      <div className="flex justify-between gap-1 text-[10px] text-soma-600">
        {points
          .filter(
            (_, index) =>
              points.length <= 7 || index === 0 || index === points.length - 1,
          )
          .map((point, index) => (
            <span key={`${point.day}-${index}`}>{point.day}</span>
          ))}
      </div>
    </div>
  )
}
