import ExternalToolCard from './ExternalToolCard'

const prevent = {
  title: 'PREVENT (American Heart Association)',
  description:
    'Calculadora externa de risco cardiovascular. A AHA descreve validação em adultos dos Estados Unidos, entre 30 e 79 anos, sem doença cardiovascular conhecida; a página oficial não informa validação brasileira. Converse sobre os resultados com seu profissional.',
  href: 'https://professional.heart.org/en/guidelines-and-statements/prevent-calculator',
  linkLabel: 'Abrir calculadora oficial PREVENT (AHA)',
}

const frax = {
  title: 'FRAX (FRAXplus)',
  description:
    'Ferramenta externa que estima a probabilidade de fratura em 10 anos. No site oficial, selecione o modelo do Brasil quando aplicável; o resultado não substitui avaliação profissional.',
  href: 'https://www.fraxplus.org/pt/calculation-tool/',
  linkLabel: 'Abrir calculadora oficial FRAX',
}

export default function ExternalClinicalTools({ audience }) {
  const isPatient = audience === 'patient'

  return (
    <section className="space-y-3" aria-labelledby={`${audience}-external-tools-title`}>
      <div>
        <h2
          id={`${audience}-external-tools-title`}
          className="text-lg font-semibold text-soma-900"
        >
          Ferramentas externas
        </h2>
        <p className="mt-1 text-sm leading-6 text-soma-700">
          {isPatient
            ? 'Estas ferramentas pertencem a outras organizações. Converse com seu profissional sobre a interpretação.'
            : 'Acesse os sites oficiais e confira as limitações e instruções de cada ferramenta.'}
        </p>
      </div>

      <ExternalToolCard {...prevent} />
      <ExternalToolCard {...frax} />

      {isPatient ? (
        <ExternalToolCard
          title="Reganho de peso após GLP-1 (Mayo Clinic)"
          description="A equipe da Mayo Clinic identifica esta calculadora como ferramenta de pesquisa para profissionais e pesquisadores, não destinada ao uso pelo paciente nem a decisões clínicas. Aqui você pode conhecer o modelo e conversar com sua equipe; o Endo + não abre nem preenche a calculadora para você."
          href="https://glp1regainrisk.com/about"
          linkLabel="Conhecer o modelo e suas limitações"
        />
      ) : (
        <ExternalToolCard
          title="Reganho de peso após GLP-1 (Mayo Clinic)"
          description="Ferramenta externa de pesquisa para profissionais e pesquisadores sobre o tempo até recuperar parte do peso após interromper semaglutida ou tirzepatida. O próprio site diz que não deve ser usada para decisões clínicas."
          href="https://glp1regainrisk.com/"
          linkLabel="Abrir calculadora de pesquisa da Mayo Clinic"
        />
      )}
    </section>
  )
}
