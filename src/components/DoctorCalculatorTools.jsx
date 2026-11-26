import { useState } from 'react'
import { Feedback, FormField, PrimaryButton, SelectField } from './ui'
import { bodyMassIndex, heightBounds, waistHeightRatio } from '../lib/anthropometry.js'
import { calculateEagMgDl, eagReferences } from '../lib/eag.js'
import { calculateFindrisc, findriscReferences } from '../lib/findrisc.js'
import { calculateSarcF, sarcFReferences } from '../lib/sarcF.js'
import { calculateAuditC, calculateGad7, calculatePhq9 } from '../lib/doctorScreeners.js'
import MetabolicFormulaTools from './MetabolicFormulaTools.jsx'

const answerOptions = [
  ['0', 'Nenhuma vez'],
  ['1', 'Vários dias'],
  ['2', 'Mais da metade dos dias'],
  ['3', 'Quase todos os dias'],
]

const phqQuestions = [
  'Pouco interesse ou pouco prazer em fazer as coisas.',
  'Sentir-se para baixo, deprimido(a) ou sem perspectiva.',
  'Dificuldade para pegar no sono ou permanecer dormindo, ou dormir mais do que de costume.',
  'Sentir-se cansado(a) ou com pouca energia.',
  'Falta de apetite ou comendo demais.',
  'Sentir-se mal consigo mesmo(a), ou achar que é um fracasso ou que decepcionou sua família ou você mesmo(a).',
  'Dificuldade para se concentrar nas coisas, como ler o jornal ou ver televisão.',
  'Mover-se ou falar tão devagar que outras pessoas poderiam ter notado? Ou estar tão agitado(a) ou inquieto(a) que você tem se movimentado muito mais do que de costume?',
  'Pensamentos de que seria melhor estar morto(a) ou de se ferir de alguma maneira?',
]

const gadQuestions = [
  'Sentir-se nervoso(a), ansioso(a) ou muito tenso(a).',
  'Não ser capaz de impedir ou de controlar as preocupações.',
  'Preocupar-se muito com diversas coisas.',
  'Dificuldade para relaxar.',
  'Ficar tão agitado(a) que se torna difícil permanecer sentado(a).',
  'Ficar facilmente aborrecido(a) ou irritado(a).',
  'Sentir medo como se algo horrível fosse acontecer.',
]

const sarcQuestions = [
  ['strength', 'Dificuldade para levantar e carregar 5 kg?', [['0', 'Nenhuma'], ['1', 'Alguma'], ['2', 'Muita ou não consegue']]],
  ['walking', 'Dificuldade para atravessar um cômodo?', [['0', 'Nenhuma'], ['1', 'Alguma'], ['2', 'Muita, usa apoio ou não consegue']]],
  ['chair', 'Dificuldade para levantar de uma cama ou cadeira?', [['0', 'Nenhuma'], ['1', 'Alguma'], ['2', 'Muita ou não consegue sem ajuda']]],
  ['stairs', 'Dificuldade para subir um lance de escadas com 10 degraus?', [['0', 'Nenhuma'], ['1', 'Alguma'], ['2', 'Muita ou não consegue']]],
  ['falls', 'Quantas vezes caiu no último ano?', [['0', 'Nenhuma'], ['1', 'De 1 a 3 vezes'], ['2', '4 vezes ou mais']]],
]

const yesNo = [['no', 'Não'], ['yes', 'Sim']]

function printNumber(value, digits = 1) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function ToolPanel({ title, description, children }) {
  return (
    <details className="group rounded-[1.5rem] bg-white shadow-card">
      <summary className="cursor-pointer rounded-[1.5rem] p-5 font-semibold text-soma-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-soma-500">
        <span>{title}</span>
        <span className="mt-1 block text-sm font-normal leading-6 text-soma-600">
          {description}
        </span>
      </summary>
      <div className="space-y-4 px-5 pb-5">{children}</div>
    </details>
  )
}

function ResultBox({ title, children, warning = false }) {
  return (
    <div className={`rounded-2xl p-4 ${warning ? 'bg-amber-50 text-amber-950' : 'bg-soma-50 text-soma-950'}`} role={warning ? 'alert' : 'status'}>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-1 text-sm leading-6">{children}</div>
    </div>
  )
}

function References({ items }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2 border-t border-soma-100 pt-3 text-xs text-soma-600">
      {items.map(({ title, label, url }) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="underline">
          {title || label}
        </a>
      ))}
    </div>
  )
}

export default function DoctorCalculatorTools({ patient }) {
  return (
    <section className="space-y-3" aria-labelledby="professional-tools-title">
      <div>
        <h2 id="professional-tools-title" className="text-lg font-semibold text-soma-900">
          Outras fórmulas e questionários
        </h2>
        <p className="mt-1 text-sm leading-6 text-soma-700">
          Uso profissional. Exceto o FIB-4, os cálculos abaixo são temporários: não são gravados no prontuário nem compartilhados com o paciente.
        </p>
      </div>
      <AnthropometryTool />
      <FindriscTool />
      <SarcFTool />
      <EagTool />
      <MentalHealthTool kind="phq9" />
      <MentalHealthTool kind="gad7" />
      <AuditCTool />
      <MetabolicFormulaTools patient={patient} />
    </section>
  )
}

function AnthropometryTool() {
  const [values, setValues] = useState({ weight: '', height: '', waist: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function update(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
    setResult(null)
    setError('')
  }

  function submit(event) {
    event.preventDefault()
    const weight = Number(values.weight)
    const height = Number(values.height)
    const waist = Number(values.waist)
    const bmi = bodyMassIndex(weight, height)
    const ratio = waist >= 30 && waist <= 300
      ? waistHeightRatio(waist, height)
      : null
    if (bmi === null || ratio === null) {
      setError('Confira peso, cintura e altura dentro dos limites informados.')
      setResult(null)
      return
    }
    setResult({ bmi, ratio })
    setError('')
  }

  return (
    <ToolPanel title="Antropometria" description="IMC e relação cintura/altura">
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Peso (kg)" name="weight" type="number" min="0.1" max="800" step="0.1" value={values.weight} onChange={update} required />
          <FormField label={`Altura (cm; ${heightBounds.min}–${heightBounds.max})`} name="height" type="number" min={heightBounds.min} max={heightBounds.max} step="0.1" value={values.height} onChange={update} required />
          <FormField label="Cintura (cm)" name="waist" type="number" min="1" max="500" step="0.1" value={values.waist} onChange={update} required />
        </div>
        <Feedback error={error} />
        <PrimaryButton type="submit">Calcular medidas</PrimaryButton>
      </form>
      {result && <ResultBox title="Resultado calculado">
        <p>IMC: <strong>{printNumber(result.bmi, 2)} kg/m²</strong></p>
        <p>Relação cintura/altura: <strong>{printNumber(result.ratio, 2)}</strong></p>
        <p className="mt-2 text-xs">Valores descritivos; não constituem diagnóstico isolado.</p>
      </ResultBox>}
      <References items={[
        { title: 'OMS: relatório técnico 894', url: 'https://iris.who.int/bitstream/handle/10665/42330/WHO_TRS_894.pdf?sequence=1' },
        { title: 'NICE NG246: cintura e altura', url: 'https://www.nice.org.uk/guidance/ng246/chapter/Identifying-and-assessing-overweight-obesity-and-central-adiposity' },
      ]} />
    </ToolPanel>
  )
}

function FindriscTool() {
  const [values, setValues] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function update(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
    setResult(null)
    setError('')
  }

  function submit(event) {
    event.preventDefault()
    if (values.diabetes !== 'no') {
      setError(values.diabetes === 'yes'
        ? 'O FINDRISC é uma triagem de risco futuro para pessoas sem diagnóstico conhecido de diabetes.'
        : 'Informe se há diagnóstico conhecido de diabetes.')
      setResult(null)
      return
    }
    try {
      setResult(calculateFindrisc({
        ageYears: values.age,
        bmi: values.bmi,
        waistCm: values.waist,
        waistReference: values.waistReference,
        dailyActivity: values.activity,
        dailyFruitVegetables: values.diet,
        hypertensionMedication: values.bpMedication,
        highGlucoseHistory: values.highGlucose,
        familyHistory: values.familyHistory,
      }))
      setError('')
    } catch (cause) {
      setResult(null)
      setError(cause.message)
    }
  }

  return (
    <ToolPanel title="FINDRISC" description="Triagem para risco futuro de diabetes tipo 2">
      <p className="text-sm leading-6 text-soma-700">Para pacientes sem diagnóstico conhecido de diabetes. Use a faixa do Ministério da Saúde com a ressalva de que a versão brasileira não calibra a probabilidade individual para o Brasil.</p>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Diagnóstico conhecido de diabetes?" name="diabetes" value={values.diabetes || ''} onChange={update} required>
            <option value="">Selecione</option>{yesNo.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </SelectField>
          <FormField label="Idade (anos completos)" name="age" type="number" min="18" max="120" step="1" value={values.age || ''} onChange={update} required />
          <FormField label="IMC (kg/m²)" name="bmi" type="number" min="10" max="100" step="0.1" value={values.bmi || ''} onChange={update} required />
          <FormField label="Cintura (cm)" name="waist" type="number" min="30" max="300" step="0.1" value={values.waist || ''} onChange={update} required />
          <SelectField label="Referência de cintura" name="waistReference" value={values.waistReference || ''} onChange={update} required>
            <option value="">Selecione</option><option value="female">Feminina</option><option value="male">Masculina</option>
          </SelectField>
          <SelectField label="Atividade física diária (≥30 min)?" name="activity" value={values.activity || ''} onChange={update} required>
            <option value="">Selecione</option>{yesNo.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </SelectField>
          <SelectField label="Consome frutas e vegetais diariamente?" name="diet" value={values.diet || ''} onChange={update} required>
            <option value="">Selecione</option>{yesNo.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </SelectField>
          <SelectField label="Usa regularmente medicamento para pressão alta?" name="bpMedication" value={values.bpMedication || ''} onChange={update} required>
            <option value="">Selecione</option>{yesNo.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </SelectField>
          <SelectField label="Histórico de glicose elevada?" name="highGlucose" value={values.highGlucose || ''} onChange={update} required>
            <option value="">Selecione</option>{yesNo.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </SelectField>
          <SelectField label="Histórico familiar de diabetes" name="familyHistory" value={values.familyHistory || ''} onChange={update} required>
            <option value="">Selecione</option><option value="none">Não</option><option value="second_degree">Avós, tios ou primos</option><option value="first_degree">Pais, irmãos ou filhos</option>
          </SelectField>
        </div>
        <Feedback error={error} />
        <PrimaryButton type="submit" disabled={values.diabetes === 'yes'}>Calcular FINDRISC</PrimaryButton>
      </form>
      {result && <ResultBox title={`FINDRISC: ${result.score}/${result.maxScore}`}>
        <p>Faixa publicada pelo Ministério da Saúde: <strong>{result.band.label}</strong>.</p>
        <p className="mt-2 text-xs">Triagem, não diagnóstico. Não fornece uma probabilidade individual calibrada para o Brasil.</p>
      </ResultBox>}
      <References items={findriscReferences} />
    </ToolPanel>
  )
}

function SarcFTool() {
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function submit(event) {
    event.preventDefault()
    try {
      setResult(calculateSarcF(answers))
      setError('')
    } catch (cause) {
      setResult(null)
      setError(cause.message)
    }
  }

  return (
    <ToolPanel title="SARC-F" description="Triagem de dificuldades relacionadas à força e mobilidade">
      <p className="text-sm leading-6 text-soma-700">A versão brasileira foi estudada em pessoas com 60 anos ou mais; interprete resultados em outras idades com cautela. Não é diagnóstico de sarcopenia.</p>
      <form className="space-y-4" onSubmit={submit}>
        {sarcQuestions.map(([key, label, options]) => (
          <SelectField key={key} label={label} value={answers[key] ?? ''} onChange={(event) => { setAnswers((current) => ({ ...current, [key]: event.target.value })); setResult(null); setError('') }} required>
            <option value="">Selecione</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </SelectField>
        ))}
        <Feedback error={error} />
        <PrimaryButton type="submit">Calcular SARC-F</PrimaryButton>
      </form>
      {result && <ResultBox title={`SARC-F: ${result.score}/${result.maxScore}`}>
        <p>{result.suggestive ? 'Pontuação igual ou superior a 4: sugere avaliação complementar.' : 'A pontuação não atingiu o corte tradicional; isso não descarta sarcopenia ou perda de força.'}</p>
        <p className="mt-2 text-xs">Pode não identificar todos os casos; não substitui avaliação de força e massa muscular.</p>
      </ResultBox>}
      <References items={sarcFReferences} />
    </ToolPanel>
  )
}

function EagTool() {
  const [hba1c, setHba1c] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function submit(event) {
    event.preventDefault()
    try {
      setResult(calculateEagMgDl(hba1c))
      setError('')
    } catch (cause) {
      setResult(null)
      setError(cause.message)
    }
  }

  return (
    <ToolPanel title="HbA1c → glicemia média estimada (eAG)" description="Conversão baseada na relação observada no estudo ADAG">
      <form className="space-y-4" onSubmit={submit}>
        <FormField label="HbA1c (%)" type="number" min="3" max="20" step="0.1" value={hba1c} onChange={(event) => { setHba1c(event.target.value); setResult(null); setError('') }} required />
        <Feedback error={error} />
        <PrimaryButton type="submit">Calcular eAG</PrimaryButton>
      </form>
      {result !== null && <ResultBox title="Glicemia média estimada">
        <p className="text-2xl font-semibold">{result} mg/dL</p>
        <p className="mt-2 text-xs">Estimativa de grupo, não medição individual; condições que alteram a HbA1c podem interferir.</p>
      </ResultBox>}
      <References items={eagReferences} />
    </ToolPanel>
  )
}

function MentalHealthTool({ kind }) {
  const isPhq = kind === 'phq9'
  const questions = isPhq ? phqQuestions : gadQuestions
  const title = isPhq ? 'PHQ-9' : 'GAD-7'
  const [answers, setAnswers] = useState(Array(questions.length).fill(''))
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function update(index, value) {
    setAnswers((current) => current.map((answer, item) => item === index ? value : answer))
    setResult(null)
    setError('')
  }

  function submit(event) {
    event.preventDefault()
    const values = answers.map((answer) => answer === '' ? null : Number(answer))
    try {
      setResult(isPhq ? calculatePhq9(values) : calculateGad7(values))
      setError('')
    } catch (cause) {
      setResult(null)
      setError(cause.message)
    }
  }

  return (
    <ToolPanel title={title} description={isPhq ? 'Questionário de saúde do paciente, sintomas nas últimas duas semanas' : 'Escala de ansiedade generalizada, sintomas nas últimas duas semanas'}>
      <p className="text-sm leading-6 text-soma-700">Rastreio e acompanhamento de sintomas; não define diagnóstico. Considere contexto clínico e impacto funcional.</p>
      <form className="space-y-4" onSubmit={submit}>
        {questions.map((question, index) => (
          <fieldset key={question} className="rounded-2xl border border-soma-100 p-4">
            <legend className="px-1 text-sm font-medium leading-6 text-soma-800">{index + 1}. {question}</legend>
            <SelectField
              label={`Frequência do item ${index + 1}`}
              value={answers[index]}
              onChange={(event) => update(index, event.target.value)}
              required
            >
              <option value="">Selecione</option>{answerOptions.map(([value, label]) => <option key={value} value={value}>{label} ({value})</option>)}
            </SelectField>
          </fieldset>
        ))}
        <Feedback error={error} />
        <PrimaryButton type="submit">Calcular {title}</PrimaryButton>
      </form>
      {result && <ResultBox title={`${title}: ${result.score}/${result.maxScore}`} warning={result.item9Positive}>
        <p>Faixa de sintomas: <strong>{result.band}</strong>.</p>
        {result.item9Positive && <p className="mt-3 font-semibold">Resposta diferente de “nenhuma vez” no item 9: faça avaliação clínica direta e oportuna de risco de suicídio/autolesão. O escore total não substitui essa avaliação.</p>}
        <p className="mt-3 text-xs">A classificação orienta a leitura do instrumento; não é diagnóstico.</p>
      </ResultBox>}
      <References items={[
        { title: 'Pfizer PHQ Screeners: instrumentos e orientações de uso', url: 'https://www.phqscreeners.com/select-screener' },
        ...(isPhq ? [{ title: 'Ministério da Saúde: versão PHQ-9 para impressão', url: 'https://linhasdecuidado.saude.gov.br/portal/depressao/unidade-de-atencao-primaria/patient-health-questionnaire/' }] : [{ title: 'Ministério da Saúde de Sergipe: protocolo APS (inclui GAD-7)', url: 'https://funesa.se.gov.br/wp-content/uploads/2025/03/protocolo-clinico-terapeutico-digital-final.pdf' }]),
      ]} />
    </ToolPanel>
  )
}

function AuditCTool() {
  const [scores, setScores] = useState(['', '', ''])
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function update(index, value) {
    setScores((current) => current.map((score, item) => item === index ? value : score))
    setResult(null)
    setError('')
  }

  function submit(event) {
    event.preventDefault()
    try {
      setResult(calculateAuditC(scores.map((score) => score === '' ? null : Number(score))))
      setError('')
    } catch (cause) {
      setResult(null)
      setError(cause.message)
    }
  }

  return (
    <ToolPanel title="AUDIT-C" description="Soma das pontuações dos três itens do instrumento oficial">
      <p className="text-sm leading-6 text-soma-700">
        O Endo + não reproduz os itens nem aplica pontos de corte. Acesse o instrumento oficial da OMS em outra aba e informe somente as três pontuações do profissional.
      </p>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-3">
          {scores.map((score, index) => (
            <SelectField key={index} label={`Pontuação do item ${index + 1} (0–4)`} value={score} onChange={(event) => update(index, event.target.value)} required>
              <option value="">Selecione</option>{Array.from({ length: 5 }, (_, value) => <option key={value} value={value}>{value}</option>)}
            </SelectField>
          ))}
        </div>
        <Feedback error={error} />
        <PrimaryButton type="submit">Somar AUDIT-C</PrimaryButton>
      </form>
      {result && <ResultBox title={`AUDIT-C: ${result.score}/${result.maxScore}`}>
        <p>Soma aritmética dos itens; nenhuma categoria ou diagnóstico é inferido pelo Endo +.</p>
      </ResultBox>}
      <References items={[
        { title: 'OMS Europa: ferramenta oficial AUDIT-C', url: 'https://sbi.euro.who.int/tools/audit-c' },
        { title: 'OMS: direitos autorais e licenciamento', url: 'https://www.who.int/about/policies/publishing/copyright' },
      ]} />
    </ToolPanel>
  )
}
