export const states = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

export function validateDoctorProfile(values) {
  const professional_name =
    typeof values.professional_name === 'string'
      ? values.professional_name.trim()
      : ''
  const crm = typeof values.crm === 'string' ? values.crm.trim() : ''
  const crm_state = String(values.crm_state ?? '').toUpperCase()
  if (professional_name.length < 2 || professional_name.length > 100)
    throw new Error('Informe seu nome profissional, com até 100 caracteres.')
  if (!/^\d{1,10}$/.test(crm) || !states.includes(crm_state))
    throw new Error('Informe o número do CRM e selecione a UF.')
  if (values.confirmed !== true)
    throw new Error('Confirme a declaração do cadastro profissional.')
  return { professional_name, crm, crm_state }
}

export function normalizeDoctorCode(value) {
  const code =
    typeof value === 'string' ? value.replace(/[\s-]/g, '').toUpperCase() : ''
  if (!/^[A-Z0-9]{6,24}$/.test(code))
    throw new Error('Use um código com 6 a 24 letras e números, sem acentos.')
  return code
}

export function validateSharing(values) {
  if (
    typeof values.doctor_id !== 'string' ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(values.doctor_id)
  )
    throw new Error('Selecione um médico antes de autorizar.')
  if (values.confirmed !== true)
    throw new Error('Confirme a autorização para compartilhar sua evolução.')
  if (
    values.days !== null &&
    !['string', 'number'].includes(typeof values.days)
  )
    throw new Error('Selecione um prazo de acesso válido.')
  const days =
    values.days === '' || values.days === null ? null : Number(values.days)
  if (days !== null && ![7, 30, 90].includes(days))
    throw new Error('Selecione um prazo de acesso válido.')
  return { p_doctor_id: values.doctor_id, p_days: days }
}

export function sharingStatus(share, now = Date.now()) {
  if (share.revoked_at) return 'Revogado'
  if (share.expires_at && new Date(share.expires_at).getTime() <= now)
    return 'Expirado'
  return 'Ativo'
}

export function sharingDeadline(value) {
  return value
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Até você revogar'
}
