import { useState } from 'react'
import { Card, Feedback, FormField, PrimaryButton, SelectField } from './ui'
import { latestAnthropometry } from '../lib/anthropometry.js'
import { ageAtDate, calculateFindrisc, findriscReferences } from '../lib/findrisc.js'
import { formatDate, localDate } from '../lib/patientData.js'

const yesNoOptions = [
  { value: 'yes', label: 'Sim' },
  { value: 'no', label: 'Não' },
]

export default function PatientFindrisc({
  profile,
  entries,
  loading = false,
}) {
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [hasDiabetes, setHasDiabetes] = useState('')
  const { weightEntry, waistEntry, bmi } = latestAnthropometry(entries)
  const ageFromProfile = ageAtDate(profile?.birth_date, localDate())
  const profileWaistReference = ['female', 'male'].includes(profile?.sex)
    ? profile.sex
    : ''

  function valueFor(key, fallback = '') {
    return Object.hasOwn(answers, key) ? answers[key] : fallback ?? ''
  }

  function update(key, value) {
    setAnswers((current) => ({ ...current, [key]: value }))
    setResult(null)
    setError('')
  }

  function submit(event) {
    event.preventDefault()
    setError('')
    setResult(null)
    if (hasDiabetes === 'yes') {
      setError(
        'O FINDRISC é uma triagem para pessoas sem diagnóstico conhecido de diabetes. Não calculamos este resultado.',
      )
      return
    }
    if (hasDiabetes !== 'no') {
      setError('Informe se já recebeu diagnóstico de diabetes.')
      return
    }

    try {
      setResult(
        calculateFindrisc({
          ageYears: valueFor('ageYears', ageFromProfile),
          bmi: valueFor('bmi', bmi),
          waistCm: valueFor('waistCm', waistEntry?.waist_cm),
          waistReference: valueFor('waistReference', profileWaistReference),
          dailyActivity: valueFor('dailyActivity'),
          dailyFruitVegetables: valueFor('dailyFruitVegetables'),
          hypertensionMedication: valueFor('hypertensionMedication'),
          highGlucoseHistory: valueFor('highGlucoseHistory'),
          familyHistory: valueFor('familyHistory'),
        }),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Confira suas respostas.')
    }
  }

  const bmiDetail = Object.hasOwn(answers, 'bmi')
    ? 'Valor informado por você para esta prévia.'
    : bmi !== null && weightEntry
      ? `Preenchido pelo IMC do registro de ${formatDate(weightEntry.entry_date)}.`
      : 'Não há IMC calculável; informe seu valor atual.'
  const waistDetail = Object.hasOwn(answers, 'waistCm')
    ? 'Valor informado por você para esta prévia.'
    : waistEntry
      ? `Preenchida pelo registro de ${formatDate(waistEntry.entry_date)}.`
      : 'Não há cintura registrada; informe sua medida atual.'
  const datesDiffer =
    weightEntry && waistEntry && weightEntry.entry_date !== waistEntry.entry_date

  return (
    <Card>
      <h2 className="text-lg font-semibold text-soma-900">FINDRISC</h2>
      <p className="mt-2 text-sm leading-6 text-soma-700">
        Questionário de triagem para estimar risco futuro de diabetes tipo 2.
        Esta é uma prévia para revisão clínica; respostas e resultados não são
        salvos no histórico.
      </p>
      <p className="mt-3 rounded-xl bg-soma-50 p-3 text-sm leading-6 text-soma-800">
        As faixas abaixo são as publicadas pelo Ministério da Saúde. A versão
        brasileira foi adaptada e estudada quanto à compreensão e confiabilidade,
        mas não estabeleceu calibração da probabilidade individual para o Brasil.
        O resultado é uma triagem, não um diagnóstico.
      </p>

      <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
        <SelectField
          label="Você já recebeu diagnóstico de diabetes?"
          value={hasDiabetes}
          onChange={(event) => {
            setHasDiabetes(event.target.value)
            setResult(null)
            setError('')
          }}
          required
        >
          <option value="">Selecione</option>
          <option value="no">Não</option>
          <option value="yes">Sim</option>
        </SelectField>
        {hasDiabetes === 'yes' && (
          <Feedback message="O FINDRISC é destinado à triagem de pessoas sem diagnóstico conhecido de diabetes. Não calculamos um resultado nesta situação." />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Idade em anos completos"
            type="number"
            min="18"
            max="120"
            step="1"
            inputMode="numeric"
            value={valueFor('ageYears', ageFromProfile)}
            onChange={(event) => update('ageYears', event.target.value)}
            required
          />
          <FormField
            label="IMC (kg/m²)"
            type="number"
            min="10"
            max="100"
            step="0.1"
            inputMode="decimal"
            value={valueFor('bmi', bmi)}
            onChange={(event) => update('bmi', event.target.value)}
            required
          />
          <p className="-mt-3 text-xs leading-5 text-soma-600 sm:col-start-2">
            {bmiDetail}
          </p>
          <FormField
            label="Circunferência da cintura (cm)"
            type="number"
            min="30"
            max="300"
            step="0.1"
            inputMode="decimal"
            value={valueFor('waistCm', waistEntry?.waist_cm)}
            onChange={(event) => update('waistCm', event.target.value)}
            required
          />
          <p className="-mt-3 text-xs leading-5 text-soma-600">
            {waistDetail}
          </p>
          <SelectField
            label="Referência de cintura do questionário"
            value={valueFor('waistReference', profileWaistReference)}
            onChange={(event) => update('waistReference', event.target.value)}
            required
          >
            <option value="">Selecione</option>
            <option value="female">Feminina</option>
            <option value="male">Masculina</option>
          </SelectField>
        </div>
        {datesDiffer && (
          <p className="text-xs leading-5 text-soma-600">
            Peso e cintura foram registrados em datas diferentes. Confira se
            representam medidas adequadas para esta avaliação ou ajuste os campos.
          </p>
        )}
        {profileWaistReference === '' && (
          <p className="text-xs leading-5 text-soma-600">
            O instrumento publica duas referências de cintura. Não selecionamos
            uma automaticamente quando essa informação não está definida no perfil.
          </p>
        )}

        <SelectField
          label="Você pratica pelo menos 30 minutos de atividade física todos os dias?"
          value={valueFor('dailyActivity')}
          onChange={(event) => update('dailyActivity', event.target.value)}
          required
        >
          <option value="">Selecione</option>
          {yesNoOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectField>
        <SelectField
          label="Você consome frutas e vegetais todos os dias?"
          value={valueFor('dailyFruitVegetables')}
          onChange={(event) => update('dailyFruitVegetables', event.target.value)}
          required
        >
          <option value="">Selecione</option>
          {yesNoOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectField>
        <SelectField
          label="Você usa ou já usou regularmente medicamento para pressão alta?"
          value={valueFor('hypertensionMedication')}
          onChange={(event) => update('hypertensionMedication', event.target.value)}
          required
        >
          <option value="">Selecione</option>
          {yesNoOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectField>
        <SelectField
          label="Alguma vez você teve glicose elevada, inclusive durante gravidez ou doença?"
          value={valueFor('highGlucoseHistory')}
          onChange={(event) => update('highGlucoseHistory', event.target.value)}
          required
        >
          <option value="">Selecione</option>
          {yesNoOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectField>
        <SelectField
          label="Histórico de diabetes na família"
          value={valueFor('familyHistory')}
          onChange={(event) => update('familyHistory', event.target.value)}
          required
        >
          <option value="">Selecione</option>
          <option value="none">Não</option>
          <option value="second_degree">Sim, em avós, tios ou primos</option>
          <option value="first_degree">Sim, em pais, irmãos ou filhos</option>
        </SelectField>

        <Feedback error={error} />
        <PrimaryButton type="submit" disabled={loading || hasDiabetes === 'yes'}>
          Calcular prévia
        </PrimaryButton>
      </form>

      {result && (
        <div className="mt-5 rounded-2xl bg-soma-100 p-4" role="status">
          <p className="text-sm font-medium text-soma-800">Pontuação FINDRISC</p>
          <p className="mt-1 text-3xl font-semibold text-soma-950">
            {result.score} <span className="text-base font-medium">/ {result.maxScore}</span>
          </p>
          <p className="mt-2 text-sm text-soma-800">
            Faixa publicada pelo Ministério da Saúde: <strong>{result.band.label}</strong>
          </p>
          <p className="mt-3 text-xs leading-5 text-soma-700">
            O instrumento não fornece uma probabilidade calibrada para cada
            pessoa no Brasil. Este resultado não confirma nem exclui diabetes e
            não substitui avaliação médica. Converse com seu profissional.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-x-3 gap-y-2 border-t border-soma-100 pt-4 text-xs text-soma-600">
        {findriscReferences.map((reference) => (
          <a
            key={reference.url}
            href={reference.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {reference.title}
          </a>
        ))}
      </div>
    </Card>
  )
}
