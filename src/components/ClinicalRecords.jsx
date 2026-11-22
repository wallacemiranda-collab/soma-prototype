import { useRef, useState } from 'react'
import { clinicalRecordTypes, localDateTime } from '../lib/clinicalModules'
import { localDate, formatNumber } from '../lib/patientData'
import { correctionReason } from '../lib/clinicalCorrections'
import { Feedback, FormField, PrimaryButton, SelectField } from './ui'

function initialValues(kind, record) {
  return Object.fromEntries(
    clinicalRecordTypes[kind].fields.map((field) => [
      field.key,
      record
        ? field.type === 'datetime-local'
          ? localDateTime(new Date(record[field.key]))
          : String(record[field.key] ?? '')
        : field.type === 'datetime-local'
          ? localDateTime()
          : field.type === 'date'
            ? localDate()
            : field.type === 'select'
              ? field.options[0][0]
              : '',
    ]),
  )
}
export function ClinicalRecordForm({
  kind,
  onSave,
  plan,
  demo = true,
  record,
  onCancel,
}) {
  const [values, setValues] = useState(() => initialValues(kind, record))
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const requestId = useRef(crypto.randomUUID())
  const definition = clinicalRecordTypes[kind]
  return (
    <form
      aria-label={record ? 'Corrigir registro clínico' : undefined}
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault()
        if (busy.current) return
        busy.current = true
        setPending(true)
        setError('')
        setMessage('')
        try {
          await onSave(
            kind,
            values,
            requestId.current,
            record ? correctionReason(reason) : undefined,
          )
          requestId.current = crypto.randomUUID()
          setValues(initialValues(kind))
          setMessage(
            demo
              ? 'Registro fictício salvo nesta aba. Nenhum dado enviado ao serviço.'
              : 'Registro salvo no seu histórico.',
          )
        } catch (failure) {
          setError(
            failure.code === 'PT409'
              ? record
                ? 'Este registro já foi corrigido. Atualize a página antes de continuar.'
                : 'O acompanhamento mudou. Atualize a página antes de salvar novamente.'
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
      <h2 className="font-semibold">
        {record
          ? `Corrigir ${definition.title.toLocaleLowerCase('pt-BR')}`
          : definition.title}
      </h2>
      {record && (
        <p className="text-sm">
          O original e o motivo ficarão preservados. Isso não altera seu
          tratamento nem a dose histórica.
        </p>
      )}
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
      {record && (
        <FormField
          label="Motivo da correção"
          value={reason}
          required
          minLength={3}
          maxLength={500}
          disabled={pending}
          onChange={(event) => {
            setReason(event.target.value)
            requestId.current = crypto.randomUUID()
          }}
        />
      )}
      <p className="text-xs leading-5 text-soma-600">
        {demo
          ? 'Horário local do aparelho. Limites de digitação provisórios, sujeitos à revisão clínica. Use apenas valores fictícios.'
          : 'O instante e o fuso do aparelho acompanham o registro. Não altere seu tratamento com base nestas anotações.'}
      </p>
      <Feedback error={error} message={message} />
      <PrimaryButton type="submit" disabled={pending}>
        {pending
          ? 'Salvando...'
          : record
            ? 'Salvar correção'
            : `Salvar ${definition.title.toLocaleLowerCase('pt-BR')}`}
      </PrimaryButton>
      {onCancel && (
        <button
          type="button"
          className="py-3 font-semibold text-soma-700"
          disabled={pending}
          onClick={onCancel}
        >
          Cancelar correção
        </button>
      )}
    </form>
  )
}

export function ClinicalHistory({
  records,
  moduleId,
  demo = true,
  onCorrect,
  onVoid,
}) {
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
          {row.voided && (
            <p className="mt-2 text-sm font-semibold">
              Desconsiderado · não entra nos resumos
            </p>
          )}
          <RecordValues row={row} />
          {!!row.audit?.length && (
            <details className="mt-4 rounded-xl border border-soma-100 p-3 text-sm">
              <summary className="cursor-pointer py-2 font-semibold">
                Ver original e alterações ({row.audit.length})
              </summary>
              <h4 className="mt-3 font-semibold">Registro original</h4>
              <RecordValues row={row.audit[0].before} />
              {row.audit.map((change) => (
                <div
                  key={change.id}
                  className="mt-4 border-t border-soma-100 pt-3"
                >
                  <p className="font-semibold">
                    {change.after ? 'Correção' : 'Registro desconsiderado'} pelo
                    paciente
                  </p>
                  <p className="mt-1 break-words">
                    {new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(change.created_at))}
                  </p>
                  <p className="mt-2 break-words">Motivo: {change.reason}</p>
                  {change.after && <RecordValues row={change.after} />}
                </div>
              ))}
            </details>
          )}
          {!row.voided && (onCorrect || onVoid) && (
            <div className="mt-4 flex flex-wrap gap-x-5">
              {onCorrect && (
                <button
                  type="button"
                  onClick={() => onCorrect(row)}
                  className="py-3 text-sm font-semibold text-soma-700"
                >
                  Corrigir registro
                </button>
              )}
              {onVoid && (
                <button
                  type="button"
                  onClick={() => onVoid(row)}
                  className="py-3 text-sm font-semibold text-soma-700"
                >
                  Desconsiderar registro
                </button>
              )}
            </div>
          )}
        </article>
      ))}
    </section>
  )
}

function RecordValues({ row }) {
  return (
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
                  new Date(field.type === 'date' ? `${value}T12:00:00` : value),
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
          <dt className="text-soma-600">Esquema registrado na aplicação</dt>
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
  )
}
