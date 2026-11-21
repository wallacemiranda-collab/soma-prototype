import {
  habitDefinitions,
  validateDate,
  validateEntry,
  validateProfile,
} from '../lib/patientData.js'
import { loadHistory } from './patientHistory.js'

export function createPatientRepository(client) {
  async function currentUser() {
    if (!client)
      throw new Error(
        'O cadastro está temporariamente indisponível. Tente novamente mais tarde.',
      )
    const { data, error } = await client.auth.getUser()
    if (error || !data?.user?.id)
      throw new Error('Sua sessão expirou. Entre novamente.')
    return data.user
  }

  function result(response) {
    if (response.error) throw response.error
    return response.data
  }

  return {
    async load() {
      const user = await currentUser()
      const responses = await Promise.all([
        client.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        loadHistory(client, 'metabolic_entries', user.id, 'entry_date'),
        loadHistory(client, 'habit_logs', user.id, 'logged_at'),
      ])
      let profile = result(responses[0])
      const entries = responses[1]
      const habitLogs = responses[2]
      if (!profile) {
        const fullName =
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'Paciente'
        profile = result(
          await client
            .from('profiles')
            .upsert(
              { id: user.id, full_name: fullName, email: user.email },
              { onConflict: 'id' },
            )
            .select()
            .single(),
        )
      }
      return { profile, entries, habitLogs }
    },
    async saveEntry(values) {
      const entry = validateEntry(values)
      const user = await currentUser()
      return result(
        await client
          .from('metabolic_entries')
          .upsert(
            { ...entry, user_id: user.id },
            { onConflict: 'user_id,entry_date' },
          )
          .select()
          .single(),
      )
    },
    async saveHabit(date, habitKey, completed) {
      validateDate(date)
      if (
        !habitDefinitions.some((habit) => habit.id === habitKey) ||
        typeof completed !== 'boolean'
      )
        throw new Error('Hábito inválido.')
      const user = await currentUser()
      return result(
        await client
          .from('habit_logs')
          .upsert(
            {
              user_id: user.id,
              logged_at: date,
              habit_key: habitKey,
              value: completed ? 1 : 0,
            },
            { onConflict: 'user_id,logged_at,habit_key' },
          )
          .select()
          .single(),
      )
    },
    async saveProfile(values) {
      const profile = validateProfile(values)
      const user = await currentUser()
      return result(
        await client
          .from('profiles')
          .upsert({ ...profile, id: user.id }, { onConflict: 'id' })
          .select()
          .single(),
      )
    },
  }
}
