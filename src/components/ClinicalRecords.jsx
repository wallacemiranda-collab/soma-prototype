import { useRef, useState } from 'react'
import { clinicalRecordTypes, localDateTime } from '../lib/clinicalModules'
import { localDate, formatNumber } from '../lib/patientData'
import { Feedback, FormField, PrimaryButton, SelectField } from './ui'

function initialValues(kind) {
  return Object.fromEntries(
    clinicalRecordTypes[kind].fields.map((field) => [
      field.key,
      field.type === 'datetime-local'
        ? localDateTime()
        : field.type === 'date'
          ? localDate()
          : field.type === 'select'
            ? field.options[0][0]
            : '',
    ]),
  )
}
export function ClinicalRecordForm({ kind, onSave, plan, demo = true }) {
  const [values, setValues] = useState(() => initialValues(kind))
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const requestId = useRef(crypto.randomUUID())
  const definition = clinicalRecordTypes[kind]
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault()
        if (busy.current) return
        busy.current = true
        setPending(true)
        setError('')
        setMessage('')
        try {
          await onSave(kind, values, requestId.current)
          requestId.current = crypto.randomUUID()
          setValues(initialValues(kind))
          setMessage(
            demo
              ? 'Registro fictício salvo nesta aba. Nenhum dado enviado ao serviço.'
              : 'Registro salvo no seu histórico.',
          )
        } catch (failure) {
          setError(
            failure.code === '40001'
              ? 'O acompanhamento mudou. Atualize a página antes de salvar novamente.'
              : failure.code === '42501'
                ? 'A autorização ou o módulo não está mais ativo. Atualize a página.'
                : failure.message ||
                  'Não foi possível salvar. Seus valores foram preservados.',
          )
        } finally {
          busy.current = false
          setPending(false)
        }
      }}
    >
      <h2 className="font-semibold">{definition.title}</h2>
      {kind === 'injection' && (
        <p className="rounded-xl bg-soma-50 p-3 text-sm">
          {demo ? 'Esquema fictício' : 'Esquema informado pelo médico'}:{' '}
          {plan.medication}, {formatNumber(plan.dose_mg, ' mg')}. O registro
          guarda esta versão, sem alterar aplicações anteriores.
        </p>
      )}
      {definition.fields.map((field) => {
        const props = {
          key: field.key,
          label: field.label,
          value: values[field.key],
          required: !field.optional,
          disabled: pending,
          onChange: (event) => {
            setValues((current) => ({
              ...current,
              [field.key]: event.target.value,
            }))
            setMessage('')
            requestId.current = crypto.randomUUID()
          },
        }
        return field.type === 'select' ? (
          <SelectField {...props}>
            {field.options.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        ) : (
          <FormField
            {...props}
            type={field.type}
            min={field.min}
            max={
              field.type === 'date'
                ? localDate()
                : field.type === 'datetime-local'
                  ? localDateTime()
                  : field.max
            }
            step={field.type === 'number' ? 'any' : undefined}
            maxLength={field.maxLength}
            inputMode={field.type === 'number' ? 'decimal' : undefined}
            autoComplete="off"
          />
        )
      })}
      <p className="text-xs leading-5 text-soma-600">
        {demo
          ? 'Horário local do aparelho. Limites de digitação provisórios, sujeitos à revisão clínica. Use apenas valores fictícios.'
          : 'O instante e o fuso do aparelho acompanham o registro. Não altere seu tratamento com base nestas anotações.'}
      </p>
      <Feedback error={error} message={message} />
      <PrimaryButton type="submit" disabled={pending}>
        {pending
          ? 'Salvando...'
          : `Salvar ${definition.title.toLocaleLowerCase('pt-BR')}`}
      </PrimaryButton>
    </form>
  )
}

export function ClinicalHistory({ records, moduleId, demo = true }) {
  const rows = records
    .filter(
      (row) => !moduleId || clinicalRecordTypes[row.kind].module === moduleId,
    )
    .sort((a, b) =>
      (b.occurred_at ?? b.occurred_on).localeCompare(
        a.occurred_at ?? a.occurred_on,
      ),
    )
  return (
    <section
      aria-label={demo ? 'Histórico clínico fictício' : 'Histórico clínico'}
      className="space-y-3"
    >
      <h2 className="text-lg font-semibold">Histórico preservado</h2>
      {!rows.length && (
        <p className="text-sm text-soma-600">
          Ainda não há anotações neste módulo.
        </p>
      )}
      {rows.map((row) => (
        <article key={row.id} className="rounded-2xl bg-white p-4 shadow-card">
          <h3 className="font-semibold">
            {clinicalRecordTypes[row.kind].title}
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            {clinicalRecordTypes[row.kind].fields.map((field) => {
              const value = row[field.key]
              const display =
                field.type === 'select'
                  ? field.options.find(([key]) => key === String(value))?.[1]
                  : field.type === 'date' || field.type === 'datetime-local'
                    ? new Intl.DateTimeFormat('pt-BR', {
                        dateStyle: 'short',
                        ...(field.type === 'datetime-local'
                          ? { timeStyle: 'short' }
                          : {}),
                      }).format(
                        new Date(
                          field.type === 'date' ? `${value}T12:00:00` : value,
                        ),
                      )
                    : field.type === 'number'
                      ? formatNumber(value)
                      : value
              return (
                <div key={field.key} className="min-w-0">
                  <dt className="text-soma-600">{field.label}</dt>
                  <dd className="break-words font-medium">{display}</dd>
                </div>
              )
            })}
            {row.kind === 'injection' && (
              <div>
                <dt className="text-soma-600">
                  Esquema registrado na aplicação
                </dt>
                <dd>
                  {row.plan_snapshot ? (
                    <>
                      {row.plan_snapshot.medication} ·{' '}
                      {formatNumber(row.plan_snapshot.dose_mg, ' mg')} · versão{' '}
                      {row.plan_revision}
                    </>
                  ) : (
                    'Referência indisponível. Atualize o histórico; não inferimos a dose atual.'
                  )}
                </dd>
              </div>
            )}
          </dl>
        </article>
      ))}
    </section>
  )
}
