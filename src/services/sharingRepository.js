import {
  normalizeDoctorCode,
  validateDoctorProfile,
  validateSharing,
} from '../lib/sharing.js'
import { loadHistory } from './patientHistory.js'

export function createSharingRepository(client) {
  async function currentUser() {
    if (!client)
      throw new Error('O compartilhamento está temporariamente indisponível.')
    const { data, error } = await client.auth.getUser()
    if (error || !data?.user?.id)
      throw new Error('Sua sessão expirou. Entre novamente.')
    return data.user
  }
  function result(response) {
    if (response.error) throw response.error
    return response.data
  }
  async function rpc(name, params) {
    await currentUser()
    return result(await client.rpc(name, params))
  }
  async function canRead(patientId) {
    return (
      (await rpc('endo_can_read_patient', { p_patient_id: patientId })) === true
    )
  }
  return {
    async listDoctors() {
      return (await rpc('endo_my_professionals')) ?? []
    },
    async lookupDoctor(value) {
      const code = normalizeDoctorCode(value)
      const rows = await rpc('endo_lookup_professional', { p_code: code })
      return rows?.[0] ?? null
    },
    async grant(values) {
      await rpc('endo_grant_doctor_access', validateSharing(values))
    },
    async revoke(doctorId) {
      const { p_doctor_id } = validateSharing({
        doctor_id: doctorId,
        confirmed: true,
        days: 30,
      })
      await rpc('endo_revoke_doctor_access', { p_doctor_id })
    },
    async loadDoctor() {
      const user = await currentUser()
      return result(
        await client
          .from('doctor_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
      )
    },
    async registerDoctor(values) {
      const profile = validateDoctorProfile(values)
      const user = await currentUser()
      return result(
        await client
          .from('doctor_profiles')
          .insert({ ...profile, user_id: user.id })
          .select()
          .single(),
      )
    },
    async updateDoctorCode(value) {
      const code = normalizeDoctorCode(value)
      const user = await currentUser()
      const response = await client
        .from('doctor_profiles')
        .update({ share_code: code })
        .eq('user_id', user.id)
        .select()
        .single()
      if (response.error?.code === '23505')
        throw new Error('Esse código não está disponível. Escolha outro.')
      return result(response)
    },
    async listPatients() {
      return (await rpc('endo_my_patients')) ?? []
    },
    canRead,
    async loadPatient(patientId) {
      const profiles = await rpc('endo_shared_profile', {
        p_patient_id: patientId,
      })
      if (!profiles?.[0])
        throw new Error('Acesso não autorizado ou encerrado pelo paciente.')
      const [entries, habitLogs] = await Promise.all([
        loadHistory(client, 'metabolic_entries', patientId, 'entry_date'),
        loadHistory(client, 'habit_logs', patientId, 'logged_at'),
      ])
      if (!(await canRead(patientId)))
        throw new Error('Acesso não autorizado ou encerrado pelo paciente.')
      return { profile: profiles[0], entries, habitLogs }
    },
  }
}
