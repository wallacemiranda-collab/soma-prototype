import { useEffect, useMemo, useState } from 'react'
import { Feedback, FormField, PrimaryButton, SelectField } from './ui'
import { ageAtDate } from '../lib/fib4.js'
import { localDate } from '../lib/patientData.js'
import {
  activityFactors,
  calculateCkdEpi2021,
  calculateCorrectedCalcium,
  calculateFreeTestosterone,
  calculateHomaIr,
  calculateKdigoRisk,
  calculateMifflin,
  calculateTyg,
  convertUnit,
  formulaDisclaimer,
  formulaReferences,
  unitConversions,
} from '../lib/metabolicFormulas.js'

const sexOptions = [
  { value: 'female', label: 'Feminino' },
  { value: 'male', label: 'Masculino' },
]

const riskLabels = {
  low: 'Baixo',
  moderate: 'Moderadamente aumentado',
  high: 'Alto',
  very_high: 'Muito alto',
}
const emptyDefaults = {}
const unitDefaults = { unit: 'glucose', direction: 'forward' }

function format(value, digits = 1) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function ReferenceLinks({ items = [] }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2 border-t border-soma-100 pt-3 text-xs text-soma-600">
      {items.map(({ label, url }) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="underline">
          {label}
        </a>
      ))}
    </div>
  )
}

function FormulaPanel({ title, description, fields, calculate, renderResult, references, note, defaults = emptyDefaults }) {
  const [values, setValues] = useState(defaults)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setValues((current) => ({ ...current, ...defaults }))
    setResult(null)
  }, [defaults])

  function update(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
    setResult(null)
    setError('')
  }

  function submit(event) {
    event.preventDefault()
    try {
      setResult(calculate(values))
      setError('')
    } catch (cause) {
      setResult(null)
      setError(cause.message)
    }
  }

  const activeFields = typeof fields === 'function' ? fields(values) : fields

  return (
    <details className="group rounded-[1.5rem] bg-white shadow-card">
      <summary className="cursor-pointer rounded-[1.5rem] p-5 font-semibold text-soma-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-soma-500">
        <span>{title}</span>
        <span className="mt-1 block text-sm font-normal leading-6 text-soma-600">{description}</span>
      </summary>
      <div className="space-y-4 px-5 pb-5">
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            {activeFields.map((field) => field.options ? (
              <SelectField
                key={field.name}
                label={field.label}
                name={field.name}
                value={values[field.name] ?? ''}
                onChange={update}
                required={field.required !== false}
              >
                {field.placeholder && <option value="">{field.placeholder}</option>}
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </SelectField>
            ) : (
              <FormField
                key={field.name}
                label={field.label}
                name={field.name}
                type="number"
                min={field.min}
                max={field.max}
                step={field.step ?? 'any'}
                value={values[field.name] ?? ''}
                onChange={update}
                required={field.required !== false}
              />
            ))}
          </div>
          <Feedback error={error} />
          <PrimaryButton type="submit">Calcular</PrimaryButton>
        </form>
        {result !== null && (
          <div className="rounded-2xl bg-soma-50 p-4 text-sm leading-6 text-soma-950" role="status">
            {renderResult(result, values)}
            <p className="mt-3 text-xs text-soma-700">{formulaDisclaimer}</p>
          </div>
        )}
        {note && <p className="text-xs leading-5 text-soma-600">{note}</p>}
        <ReferenceLinks items={references} />
      </div>
    </details>
  )
}

export default function MetabolicFormulaTools({ patient }) {
  const defaults = useMemo(() => {
    const age = patient?.birth_date ? ageAtDate(patient.birth_date, localDate()) : null
    const profileSex = sexOptions.some((option) => option.value === patient?.sex)
      ? patient.sex
      : ''
    return {
      ...(age === null ? {} : { age_years: String(age) }),
      sex: profileSex,
    }
  }, [patient?.birth_date, patient?.sex])

  const unitFields = (values) => {
    const unit = unitConversions.find((item) => item.id === values.unit) ?? unitConversions[0]
    const reverse = values.direction === 'reverse'
    const from = reverse ? unit.to : unit.from
    const to = reverse ? unit.from : unit.to
    const valueBounds = unit.id === 'hba1c'
      ? reverse ? { min: 9, max: 195, step: '1' } : { min: 3, max: 20, step: '0.1' }
      : { min: 0, max: 100000, step: 'any' }
    return [
      {
        name: 'unit',
        label: 'Exame ou medida',
        options: unitConversions.map(({ id, label }) => ({ value: id, label })),
      },
      {
        name: 'direction',
        label: 'Conversão',
        options: [
          { value: 'forward', label: `${unit.from} para ${unit.to}` },
          { value: 'reverse', label: `${unit.to} para ${unit.from}` },
        ],
      },
      { name: 'value', label: `Valor (${from})`, ...valueBounds },
    ]
  }

  return (
    <section className="space-y-3" aria-labelledby="metabolic-formulas-title">
      <div>
        <h2 id="metabolic-formulas-title" className="text-lg font-semibold text-soma-900">
          Fórmulas metabólicas profissionais
        </h2>
        <p className="mt-1 text-sm leading-6 text-soma-700">
          Cálculos temporários, visíveis somente nesta área profissional. Não são salvos nem compartilhados.
        </p>
      </div>

      <FormulaPanel
        title="eTFG CKD-EPI 2021"
        description="Estimativa baseada em creatinina, idade e sexo usado na equação"
        defaults={defaults}
        fields={[
          { name: 'creatinine_mg_dl', label: 'Creatinina (mg/dL)', min: '0.1', max: '20' },
          { name: 'age_years', label: 'Idade (anos completos)', min: '18', max: '120', step: '1' },
          { name: 'sex', label: 'Sexo usado na equação', options: sexOptions, placeholder: 'Selecione' },
        ]}
        calculate={calculateCkdEpi2021}
        renderResult={(result) => <><p>eTFG estimada: <strong>{result.egfr_ml_min_173m2} mL/min/1,73 m²</strong></p><p>Categoria GFR: <strong>{result.stage}</strong></p></>}
        references={formulaReferences.ckdEpi2021}
        note="A classificação de doença renal considera causa, cronicidade, eTFG e albuminúria. Uma medida isolada não estabelece diagnóstico."
      />

      <FormulaPanel
        title="Classificação de risco KDIGO (G × A)"
        description="Combina a categoria de eTFG com a relação albumina/creatinina urinária"
        fields={[
          { name: 'egfr_ml_min_173m2', label: 'eTFG (mL/min/1,73 m²)', min: '0', max: '250' },
          { name: 'acr_mg_g', label: 'Albumina/creatinina urinária (mg/g)', min: '0', max: '100000' },
        ]}
        calculate={calculateKdigoRisk}
        renderResult={(result) => <><p>Categoria: <strong>{result.gfr}{result.albuminuria}</strong></p><p>Faixa na matriz KDIGO: <strong>{riskLabels[result.risk]}</strong></p></>}
        references={formulaReferences.ckdEpi2021}
        note="A matriz descreve risco em pessoas com DRC; interprete com causa e persistência dos achados, não como diagnóstico automático."
      />

      <FormulaPanel
        title="HOMA-IR"
        description="Estimativa a partir de glicemia e insulina de jejum"
        fields={[
          { name: 'glucose_mg_dl', label: 'Glicemia de jejum (mg/dL)', min: '20', max: '600' },
          { name: 'insulin_uU_ml', label: 'Insulina de jejum (µU/mL)', min: '0.5', max: '500' },
        ]}
        calculate={calculateHomaIr}
        renderResult={(result) => <p>HOMA-IR: <strong>{format(result.homa_ir, 2)}</strong></p>}
        references={formulaReferences.homaIr}
        note="É uma estimativa dependente do ensaio de insulina e das condições de coleta; não há ponto de corte universal para diagnóstico individual."
      />

      <FormulaPanel
        title="Índice TyG"
        description="Índice triglicerídeos-glicose com valores em mg/dL"
        fields={[
          { name: 'triglycerides_mg_dl', label: 'Triglicerídeos (mg/dL)', min: '10', max: '10000' },
          { name: 'glucose_mg_dl', label: 'Glicemia de jejum (mg/dL)', min: '20', max: '600' },
        ]}
        calculate={calculateTyg}
        renderResult={(result) => <p>TyG: <strong>{format(result.tyg, 2)}</strong></p>}
        references={formulaReferences.tyg}
        note="Índice derivado de exames de jejum; não fornece diagnóstico isolado."
      />

      <FormulaPanel
        title="Cálcio corrigido pela albumina"
        description="Estimativa pela fórmula de Payne"
        fields={[
          { name: 'calcium_mg_dl', label: 'Cálcio total (mg/dL)', min: '2', max: '20' },
          { name: 'albumin_g_dl', label: 'Albumina (g/dL)', min: '0.5', max: '7' },
        ]}
        calculate={calculateCorrectedCalcium}
        renderResult={(result) => <p>Cálcio corrigido estimado: <strong>{format(result.corrected_calcium_mg_dl)} mg/dL</strong></p>}
        references={formulaReferences.correctedCalcium}
        note="Estimativa matemática; a interpretação pode variar conforme o contexto clínico e laboratorial."
      />

      <FormulaPanel
        title="Mifflin-St Jeor"
        description="Estimativa de gasto energético basal e, opcionalmente, total"
        defaults={defaults}
        fields={[
          { name: 'weight_kg', label: 'Peso (kg)', min: '25', max: '400' },
          { name: 'height_cm', label: 'Altura (cm)', min: '100', max: '250' },
          { name: 'age_years', label: 'Idade (anos completos)', min: '18', max: '120', step: '1' },
          { name: 'sex', label: 'Sexo usado na equação', options: sexOptions, placeholder: 'Selecione' },
          { name: 'activity', label: 'Fator de atividade (opcional)', required: false, options: [{ value: '', label: 'Não estimar gasto total' }, ...activityFactors.map(({ id, label }) => ({ value: id, label }))] },
        ]}
        calculate={(values) => calculateMifflin({ ...values, activity: values.activity || undefined })}
        renderResult={(result) => <><p>Gasto energético basal estimado: <strong>{result.bmr_kcal_day} kcal/dia</strong></p>{result.tdee_kcal_day !== null && <p>Estimativa com fator de atividade: <strong>{result.tdee_kcal_day} kcal/dia</strong></p>}</>}
        references={formulaReferences.mifflin}
        note="Estimativa populacional; não equivale à calorimetria indireta nem define uma meta alimentar."
      />

      <FormulaPanel
        title="Testosterona livre calculada"
        description="Equação de Vermeulen a partir de testosterona total, SHBG e albumina"
        fields={[
          { name: 'total_t_ng_dl', label: 'Testosterona total (ng/dL)', min: '1', max: '3000' },
          { name: 'shbg_nmol_l', label: 'SHBG (nmol/L)', min: '1', max: '500' },
          { name: 'albumin_g_dl', label: 'Albumina (g/dL; padrão 4,3)', min: '1', max: '7' },
        ]}
        calculate={calculateFreeTestosterone}
        renderResult={(result) => <><p>Testosterona livre calculada: <strong>{format(result.free_t_nmol_l, 3)} nmol/L</strong></p><p>{format(result.free_t_pg_ml)} pg/mL ({format(result.free_t_percent, 2)}% da testosterona total)</p></>}
        references={formulaReferences.vermeulen}
        note="Resultado calculado, não medido. Verifique unidades, método laboratorial e adequação da equação ao contexto."
      />

      <FormulaPanel
        title="Conversão de unidades laboratoriais"
        description="Conversões entre unidades comuns de glicose, lipídios, eletrólitos e HbA1c"
        defaults={unitDefaults}
        fields={unitFields}
        calculate={(values) => {
          const unit = unitConversions.find((item) => item.id === values.unit)
          const converted = convertUnit(values.unit, values.value, values.direction)
          return {
            converted,
            unit: values.direction === 'reverse' ? unit.from : unit.to,
          }
        }}
        renderResult={(result) => <p>Valor convertido: <strong>{format(result.converted, 2)} {result.unit}</strong></p>}
        note="Confirme a unidade de origem e a convenção usada pelo laboratório antes de registrar o resultado."
      />
    </section>
  )
}
