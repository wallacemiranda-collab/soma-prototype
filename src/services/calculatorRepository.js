import { createAccessRequestId } from '../lib/accessRequestId.js'
import { validateFib4Inputs } from '../lib/fib4.js'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function uuid(value) {
  if (typeof value !== 'string' || !uuidPattern.test(value))
    throw new Error('Identificador inválido. Atualize a tela e tente novamente.')
  return value
}

export function createCalculatorRepository(
  client,
  { enabled = false, now = () => new Date() } = {},
) {
  async function currentUser() {
    if (!enabled || !client)
      throw new Error('As calculadoras ainda não estão liberadas.')
    const { data, error } = await client.auth.getUser()
    if (error || !data?.user?.id)
      throw new Error('Sua sessão expirou. Entre novamente.')
    return data.user
  }

  async function rpc(name, args, expectedUser) {
    const user = await currentUser()
    if (expectedUser && user.id !== expectedUser)
      throw new Error('A conta mudou. Atualize para continuar.')
    const response = await client.rpc(name, args)
    if (response.error) throw response.error
    if ((await currentUser()).id !== user.id)
      throw new Error('A conta mudou. Atualize para continuar.')
    return response.data
  }

  return {
    async saveDoctorFib4(patientId, values) {
      uuid(patientId)
      const inputs = validateFib4Inputs(values, { now: now() })
      const saved = await rpc('endo_save_fib4_result', {
        p_patient_id: patientId,
        p_access_request_id: createAccessRequestId(),
        p_age_years: inputs.age_years,
        p_ast_u_l: inputs.ast_u_l,
        p_alt_u_l: inputs.alt_u_l,
        p_platelets_10e9_l: inputs.platelets_10e9_l,
        p_test_date: inputs.test_date,
      })
      if (!saved || typeof saved !== 'object' || !saved.id)
        throw new Error('Não foi possível salvar o resultado no histórico.')
      return saved
    },

    async listForDoctor(patientId) {
      uuid(patientId)
      const user = await currentUser()
      const rows = await rpc('endo_doctor_calculator_results', {
        p_patient_id: patientId,
        p_offset: 0,
        p_limit: 100,
        p_access_request_id: createAccessRequestId(),
      }, user.id)
      if (!Array.isArray(rows))
        throw new Error('Não foi possível confirmar o histórico de cálculos.')
      return rows
    },

    async listForPatient() {
      const user = await currentUser()
      const rows = await rpc('endo_patient_calculator_results', {
        p_offset: 0,
        p_limit: 100,
      }, user.id)
      if (!Array.isArray(rows))
        throw new Error('Não foi possível carregar os resultados compartilhados.')
      return rows
    },

    async setPatientVisibility(resultId, visible) {
      uuid(resultId)
      if (typeof visible !== 'boolean')
        throw new Error('Escolha uma opção válida de compartilhamento.')
      const result = await rpc('endo_set_calculator_result_visibility', {
        p_result_id: resultId,
        p_shared_with_patient: visible,
      })
      if (!result || typeof result !== 'object' || result.id !== resultId)
        throw new Error('Não foi possível atualizar o compartilhamento.')
      return {
        id: resultId,
        shared_with_patient: result.shared_with_patient === true,
      }
    },
  }
}
