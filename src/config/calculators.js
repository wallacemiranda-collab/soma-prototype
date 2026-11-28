export const calculatorsEnabled =
  import.meta.env?.VITE_CALCULATORS_ENABLED === 'true'

export function canPatientUseCalculators(environment = import.meta.env ?? {}) {
  return (
    environment.VITE_CALCULATORS_ENABLED === 'true' ||
    environment.VITE_PATIENT_CALCULATORS_ENABLED === 'true'
  )
}

export const patientCalculatorsEnabled = canPatientUseCalculators()
