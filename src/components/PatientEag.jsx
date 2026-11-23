import { useState } from 'react'
import { Card, Feedback, FormField, PrimaryButton } from './ui'
import { calculateEagMgDl, eagReferences } from '../lib/eag.js'

export default function PatientEag() {
  const [hba1c, setHba1c] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function submit(event) {
    event.preventDefault()
    setError('')
    setResult(null)
    try {
      setResult(calculateEagMgDl(hba1c))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Confira o valor informado.')
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-soma-900">
        HbA1c → glicemia média estimada
      </h2>
      <p className="mt-2 text-sm leading-6 text-soma-700">
        Informe a HbA1c em percentual, como aparece no exame. Esta prévia não
        salva o valor informado nem o resultado.
      </p>

      <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
        <FormField
          label="HbA1c (%)"
          type="number"
          min="3"
          max="20"
          step="0.1"
          inputMode="decimal"
          value={hba1c}
          onChange={(event) => {
            setHba1c(event.target.value)
            setResult(null)
            setError('')
          }}
          required
        />
        <Feedback error={error} />
        <PrimaryButton type="submit">Calcular prévia</PrimaryButton>
      </form>

      {result !== null && (
        <div className="mt-5 rounded-2xl bg-soma-100 p-4" role="status">
          <p className="text-sm font-medium text-soma-800">
            Glicemia média estimada (eAG)
          </p>
          <p className="mt-1 text-3xl font-semibold text-soma-950">
            {result} <span className="text-base font-medium">mg/dL</span>
          </p>
          <p className="mt-3 text-xs leading-5 text-soma-700">
            É uma estimativa baseada em uma relação observada em grupos de
            pessoas; não é uma medição de glicemia e pode não corresponder às
            leituras individuais. Algumas condições, como anemia, perda ou
            transfusão recente de sangue e doença renal, podem afetar a HbA1c.
            Converse com seu profissional de saúde.
          </p>
          {(Number(String(hba1c).replace(',', '.')) < 4 ||
            Number(String(hba1c).replace(',', '.')) > 15) && (
            <p className="mt-2 text-xs leading-5 text-soma-700">
              O NIDDK recomenda considerar possível interferência no exame
              quando a HbA1c é menor que 4% ou maior que 15%. Confirme esses
              valores com o laboratório ou seu profissional.
            </p>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-x-3 gap-y-2 border-t border-soma-100 pt-4 text-xs text-soma-600">
        {eagReferences.map((reference) => (
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
