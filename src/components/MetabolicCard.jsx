export default function MetabolicCard({ children, className = '', emphasis = false }) {
  return (
    <section
      className={`rounded-[1.5rem] p-5 shadow-card transition duration-200 ${
        emphasis ? 'bg-soma-900 text-white' : 'border border-soma-100/60 bg-white'
      } ${className}`}
    >
      {children}
    </section>
  )
}
