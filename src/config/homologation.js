export const homologationProject = 'ctcsolobseerqnddahun'
export const homologationEnabled =
  (import.meta.env ?? {}).VITE_HOMOLOGATION_ENABLED === 'true'

export function isSyntheticLogin(email) {
  return (
    typeof email === 'string' &&
    /^endo-[0-9a-f]{16}-(patient|otherpatient|doctor|otherdoctor|nutritionist)@example\.invalid$/.test(
      email.trim(),
    )
  )
}
