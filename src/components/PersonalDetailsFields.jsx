import { localDate, sexOptions } from '../lib/patientData'
import { FormField, SelectField } from './ui'

export default function PersonalDetailsFields({ values, onChange, disabled }) {
  return (
    <fieldset className="min-w-0 space-y-4" disabled={disabled}>
      <legend className="mb-4 font-semibold text-soma-900">Dados pessoais</legend>
      <FormField
        label="Data de nascimento (opcional)"
        type="date"
        name="birth_date"
        autoComplete="bday"
        min="0001-01-01"
        max={localDate()}
        value={values.birth_date ?? ''}
        disabled={disabled}
        onChange={(event) => onChange({ birth_date: event.target.value })}
      />
      <SelectField
        label="Sexo (opcional)"
        name="sex"
        value={values.sex ?? ''}
        disabled={disabled}
        onChange={(event) => onChange({ sex: event.target.value })}
      >
        <option value="">Selecione, se desejar</option>
        {sexOptions.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      <p className="text-xs leading-5 text-soma-600">
        Estas informações ficam no seu perfil, separadas das medidas de cada dia.
        Você pode alterá-las ou removê-las depois.
      </p>
    </fieldset>
  )
}
