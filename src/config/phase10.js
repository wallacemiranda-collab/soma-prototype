export const RESEARCH_EXPORT_ENABLED = false

export const glp1TreatmentEnabled =
  import.meta.env.VITE_GLP1_TREATMENT_ENABLED === 'true'

export const glp1TreatmentVisible = glp1TreatmentEnabled || import.meta.env.DEV === true

export const glp1EducationVideos = []
