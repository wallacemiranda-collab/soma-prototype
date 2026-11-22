import { useEffect, useRef, useState } from 'react'
import { clinicalRecordTypes } from '../lib/clinicalModules'
import { correctionReason } from '../lib/clinicalCorrections'
import { ClinicalRecordForm } from './ClinicalRecords'
import { Feedback, FormField, PrimaryButton } from './ui'

export default function ClinicalCorrectionEditor({
  record,
  mode,
  onSave,
  onCancel,
}) {
  const heading = useRef(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  return (
    <section
      className="my-5 rounded-2xl border border-soma-200 bg-white p-4"
      aria-label="Revisar anotação"
    >
      <h2 ref={heading} tabIndex={-1} className="mb-4 text-lg font-semibold">
        Revisar sua anotação
      </h2>
      {mode === 'correct' ? (
        <ClinicalRecordForm
          kind={record.kind}
          record={record}
          demo={false}
          plan={record.plan_snapshot || {}}
          onSave={onSave}
          onCancel={onCancel}
        />
      ) : (
        <VoidForm record={record} onSave={onSave} onCancel={onCancel} />
      )}
    </section>
  )
}
function VoidForm({ record, onSave, onCancel }) {
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(crypto.randomUUID())
  const busy = useRef(false)
  return (
    <form
      aria-label="Desconsiderar registro clínico"
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault()
        if (busy.current || !confirmed) return
        busy.current = true
        setPending(true)
        setError('')
        try {
          await onSave(
            record.kind,
            null,
            request.current,
            correctionReason(reason),
          )
        } catch (failure) {
          setError(
            failure.code === 'PT409'
              ? 'Este registro já foi alterado. Atualize a página.'
              : failure.message || 'Não foi possível salvar. Tente novamente.',
          )
        } finally {
          busy.current = false
          setPending(false)
        }
      }}
    >
      <h3 className="font-semibold">
        Desconsiderar{' '}
        {clinicalRecordTypes[record.kind].title.toLocaleLowerCase('pt-BR')}
      </h3>
      <p className="text-sm">
        O registro não será apagado. Ficará identificado como desconsiderado e
        não entrará nos resumos nem na próxima aplicação prevista. Isso não
        altera seu tratamento.
      </p>
      <FormField
        label="Motivo para desconsiderar"
        value={reason}
        required
        minLength={3}
        maxLength={500}
        disabled={pending}
        onChange={(event) => {
          setReason(event.target.value)
          request.current = crypto.randomUUID()
        }}
      />
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          required
          checked={confirmed}
          disabled={pending}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0"
        />
        Confirmo que desejo desconsiderar esta anotação, preservando o original.
      </label>
      <Feedback error={error} />
      <PrimaryButton type="submit" disabled={pending || !confirmed}>
        {pending ? 'Salvando...' : 'Confirmar registro desconsiderado'}
      </PrimaryButton>
      <button
        type="button"
        disabled={pending}
        onClick={onCancel}
        className="py-3 font-semibold text-soma-700"
      >
        Cancelar revisão
      </button>
    </form>
  )
}
