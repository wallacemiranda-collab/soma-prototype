import {
  normalizeDoctorCode,
  validateDoctorProfile,
  validateSharing,
} from '../lib/sharing.js'
import { createAccessRequestId } from '../lib/accessRequestId.js'

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
  async function loadAuditedHistory(patientId, resource, accessRequestId) {
    const rows = []
    for (let offset = 0; ; offset += 500) {
      const page = await rpc('endo_audited_patient_page', {
        p_patient_id: patientId,
        p_resource: resource,
        p_offset: offset,
        p_limit: 500,
        p_access_request_id: accessRequestId,
      })
      if (!Array.isArray(page))
        throw new Error('Não foi possível confirmar o histórico autorizado.')
      rows.push(...page)
      if (page.length < 500) return rows
    }
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
    async loadAccessHistory(limit = 50, offset = 0) {
      const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200)
      const safeOffset = Math.min(Math.max(Number(offset) || 0, 0), 10000000)
      return (await rpc('endo_patient_access_history', {
        p_limit: safeLimit,
        p_offset: safeOffset,
      })) ?? []
    },
    canRead,
    async loadPatient(patientId) {
      const accessRequestId = createAccessRequestId()
      const [entries, habitLogs] = await Promise.all([
        loadAuditedHistory(patientId, 'entries', accessRequestId),
        loadAuditedHistory(patientId, 'habits', accessRequestId),
      ])
      const profiles = await loadAuditedHistory(
        patientId,
        'profile',
        accessRequestId,
      )
      if (!(await canRead(patientId)))
        throw new Error('Acesso não autorizado ou encerrado pelo paciente.')
      if (!profiles[0])
        throw new Error('Acesso não autorizado ou encerrado pelo paciente.')
      return { profile: profiles[0], entries, habitLogs }
    },
    async loadPatientProfile(patientId) {
      const actor = await currentUser()
      const accessRequestId = createAccessRequestId()
      const profiles = await loadAuditedHistory(
        patientId,
        'profile',
        accessRequestId,
      )
      if (
        !(await canRead(patientId)) ||
        !profiles[0] ||
        profiles[0].id !== patientId ||
        (await currentUser()).id !== actor.id
      )
        throw new Error('Acesso não autorizado ou encerrado pelo paciente.')
      return profiles[0]
    },
  }
}
