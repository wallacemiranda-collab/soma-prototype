export default function MetabolicCard({ children, className = '', emphasis = false }) {
  return (
    <section
      className={`rounded-[1.5rem] p-5 shadow-card transition duration-200 ${
        emphasis ? 'brand-hero text-white' : 'border border-soma-100/70 bg-white'
      } ${className}`}
    >
      {children}
    </section>
  )
}
