import {
  emptyReminderPreview,
  reminderKinds,
  validateReminderPreview,
} from '../lib/reminderPreview.js'
import { isSyntheticPatient } from '../lib/reminderFeature.js'

export const reminderConsentVersion = 'endo-reminders-homologation-v1'

export function createReminderRepository(
  client,
  { enabled = false } = {},
) {
  async function currentPatient(patientId) {
    if (!enabled || !client)
      throw new Error('Os lembretes de homologação estão indisponíveis.')
    const { data, error } = await client.auth.getUser()
    const user = data?.user
    if (
      error ||
      !user?.id ||
      user.id !== patientId ||
      !isSyntheticPatient(user.email)
    )
      throw new Error('Entre com uma conta fictícia de paciente para continuar.')
    return user
  }

  function result(response) {
    if (response.error) throw response.error
    return response.data
  }

  function normalizeStoredTime(value, fallback) {
    if (typeof value !== 'string') return fallback
    const match = /^(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value)
    return match?.[1] ?? fallback
  }

  async function load(patientId) {
    await currentPatient(patientId)
    const [settingsResponse, rulesResponse] = await Promise.all([
      client
        .from('patient_reminder_preferences')
        .select('*')
        .eq('patient_id', patientId)
        .maybeSingle(),
      client
        .from('patient_reminder_rules')
        .select('*')
        .eq('patient_id', patientId),
    ])
    const settings = result(settingsResponse)
    const storedRules = result(rulesResponse) ?? []
    const value = emptyReminderPreview(settings?.time_zone)
    value.enabled = Boolean(
      settings?.enabled &&
        settings?.consent_version === reminderConsentVersion &&
        !settings?.consent_revoked_at,
    )
    if (settings) {
      value.quiet = {
        enabled: settings.quiet_hours_enabled,
        start: normalizeStoredTime(settings.quiet_start, '22:00'),
        end: normalizeStoredTime(settings.quiet_end, '08:00'),
      }
    }
    value.rules = reminderKinds.map((kind) => {
      const rule = storedRules.find((row) => row.kind === kind.id)
      return {
        id: kind.id,
        enabled: Boolean(rule?.enabled),
        time: normalizeStoredTime(rule?.reminder_time, kind.time),
        ...(kind.frequency === 'weekly'
          ? {
              weekday: Number.isInteger(rule?.weekday)
                ? rule.weekday
                : kind.weekday,
            }
          : {}),
      }
    })
    return {
      value: validateReminderPreview(value),
      consented: Boolean(
        settings?.consent_version === reminderConsentVersion &&
          settings?.consented_at &&
          !settings?.consent_revoked_at,
      ),
      consentRevokedAt: settings?.consent_revoked_at ?? null,
    }
  }

  return {
    load,
    async save(patientId, value, { consentAccepted = false } = {}) {
      await currentPatient(patientId)
      const schedule = validateReminderPreview(value)
      if (consentAccepted !== true)
        throw new Error('Autorize salvar os horários antes de continuar.')
      if (schedule.enabled && !schedule.rules.some((rule) => rule.enabled))
        throw new Error('Escolha ao menos um lembrete para ativar a agenda.')
      result(
        await client.rpc('endo_save_patient_reminder_schedule', {
          p_schedule: schedule,
          p_consent_accepted: true,
        }),
      )
      return load(patientId)
    },

    async revoke(patientId) {
      await currentPatient(patientId)
      result(
        await client.rpc('endo_revoke_patient_reminder_schedule'),
      )
      return load(patientId)
    },
  }
}
