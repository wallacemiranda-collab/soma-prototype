export const formulaReferences = {
  ckdEpi2021: [
    { label: 'Inker et al., NEJM 2021 (CKD-EPI 2021, sem raça)', url: 'https://doi.org/10.1056/NEJMoa2102953' },
    { label: 'KDIGO 2024 CKD Guideline', url: 'https://kdigo.org/guidelines/ckd-evaluation-and-management/' },
  ],
  homaIr: [{ label: 'Matthews et al., Diabetologia 1985', url: 'https://doi.org/10.1007/BF00280883' }],
  tyg: [{ label: 'Simental-Mendía et al., Metab Syndr Relat Disord 2008', url: 'https://doi.org/10.1089/met.2008.0034' }],
  correctedCalcium: [{ label: 'Payne et al., BMJ 1973', url: 'https://doi.org/10.1136/bmj.4.5893.643' }],
  mifflin: [{ label: 'Mifflin et al., Am J Clin Nutr 1990', url: 'https://doi.org/10.1093/ajcn/51.2.241' }],
  vermeulen: [{ label: 'Vermeulen et al., JCEM 1999', url: 'https://doi.org/10.1210/jcem.84.10.6079' }],
}

function parseNumber(value, { min, max }, label, integer = false) {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === ''))
    throw new Error(`Informe ${label}.`)
  const number = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : Number(value)
  if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number)))
    throw new Error(`${label} fora do intervalo permitido (${min} a ${max}).`)
  return number
}

function parseSex(value) {
  if (value !== 'female' && value !== 'male')
    throw new Error('Informe o sexo usado na equação (feminino ou masculino).')
  return value
}

const round = (value, digits) => {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON * Math.sign(value)) * factor) / factor
}

export const ckdEpiBounds = {
  creatinine: { min: 0.1, max: 20 },
  age: { min: 18, max: 120 },
}

export function calculateCkdEpi2021({ creatinine_mg_dl, age_years, sex }) {
  const scr = parseNumber(creatinine_mg_dl, ckdEpiBounds.creatinine, 'a creatinina (mg/dL)')
  const age = parseNumber(age_years, ckdEpiBounds.age, 'a idade', true)
  const s = parseSex(sex)
  const kappa = s === 'female' ? 0.7 : 0.9
  const alpha = s === 'female' ? -0.241 : -0.302
  const ratio = scr / kappa
  const egfr = 142 * Math.min(ratio, 1) ** alpha * Math.max(ratio, 1) ** -1.2 * 0.9938 ** age * (s === 'female' ? 1.012 : 1)
  const value = Math.round(egfr)
  return { egfr_ml_min_173m2: value, stage: kdigoGfrCategory(value) }
}

export function kdigoGfrCategory(egfr) {
  if (!Number.isFinite(egfr) || egfr < 0) return null
  if (egfr >= 90) return 'G1'
  if (egfr >= 60) return 'G2'
  if (egfr >= 45) return 'G3a'
  if (egfr >= 30) return 'G3b'
  if (egfr >= 15) return 'G4'
  return 'G5'
}

export function kdigoAlbuminuriaCategory(acr_mg_g) {
  const acr = parseNumber(acr_mg_g, { min: 0, max: 100000 }, 'a relação albumina/creatinina (mg/g)')
  if (acr < 30) return 'A1'
  if (acr <= 300) return 'A2'
  return 'A3'
}

const kdigoMatrix = {
  G1: ['low', 'moderate', 'high'],
  G2: ['low', 'moderate', 'high'],
  G3a: ['moderate', 'high', 'very_high'],
  G3b: ['high', 'very_high', 'very_high'],
  G4: ['very_high', 'very_high', 'very_high'],
  G5: ['very_high', 'very_high', 'very_high'],
}

export function kdigoRisk(gfrCategory, albuminuriaCategory) {
  const row = kdigoMatrix[gfrCategory]
  const column = { A1: 0, A2: 1, A3: 2 }[albuminuriaCategory]
  return row && column !== undefined ? row[column] : null
}

export function calculateKdigoRisk({ egfr_ml_min_173m2, acr_mg_g }) {
  const egfr = parseNumber(egfr_ml_min_173m2, { min: 0, max: 250 }, 'a eTFG (mL/min/1,73 m²)')
  const gfr = kdigoGfrCategory(egfr)
  const albuminuria = kdigoAlbuminuriaCategory(acr_mg_g)
  return { gfr, albuminuria, risk: kdigoRisk(gfr, albuminuria) }
}

export function calculateHomaIr({ glucose_mg_dl, insulin_uU_ml }) {
  const glucose = parseNumber(glucose_mg_dl, { min: 20, max: 600 }, 'a glicemia de jejum (mg/dL)')
  const insulin = parseNumber(insulin_uU_ml, { min: 0.5, max: 500 }, 'a insulina de jejum (µU/mL)')
  return { homa_ir: round((glucose * insulin) / 405, 2) }
}

export function calculateTyg({ triglycerides_mg_dl, glucose_mg_dl }) {
  const tg = parseNumber(triglycerides_mg_dl, { min: 10, max: 10000 }, 'os triglicerídeos (mg/dL)')
  const glucose = parseNumber(glucose_mg_dl, { min: 20, max: 600 }, 'a glicemia de jejum (mg/dL)')
  return { tyg: round(Math.log((tg * glucose) / 2), 2) }
}

export function calculateCorrectedCalcium({ calcium_mg_dl, albumin_g_dl }) {
  const calcium = parseNumber(calcium_mg_dl, { min: 2, max: 20 }, 'o cálcio total (mg/dL)')
  const albumin = parseNumber(albumin_g_dl, { min: 0.5, max: 7 }, 'a albumina (g/dL)')
  return { corrected_calcium_mg_dl: round(calcium + 0.8 * (4 - albumin), 1) }
}

export const activityFactors = [
  { id: 'sedentary', label: 'Sedentário', factor: 1.2 },
  { id: 'light', label: 'Levemente ativo', factor: 1.375 },
  { id: 'moderate', label: 'Moderadamente ativo', factor: 1.55 },
  { id: 'very', label: 'Muito ativo', factor: 1.725 },
  { id: 'extra', label: 'Extremamente ativo', factor: 1.9 },
]

export function calculateMifflin({ weight_kg, height_cm, age_years, sex, activity }) {
  const weight = parseNumber(weight_kg, { min: 25, max: 400 }, 'o peso (kg)')
  const height = parseNumber(height_cm, { min: 100, max: 250 }, 'a altura (cm)')
  const age = parseNumber(age_years, { min: 18, max: 120 }, 'a idade', true)
  const s = parseSex(sex)
  const bmr = 10 * weight + 6.25 * height - 5 * age + (s === 'male' ? 5 : -161)
  const factor = activityFactors.find((item) => item.id === activity)?.factor ?? null
  return { bmr_kcal_day: Math.round(bmr), tdee_kcal_day: factor ? Math.round(bmr * factor) : null }
}

const K_SHBG = 1e9
const K_ALB = 3.6e4
const ALBUMIN_MOLAR_MASS = 69000

export function calculateFreeTestosterone({ total_t_ng_dl, shbg_nmol_l, albumin_g_dl = 4.3 }) {
  const totalNgDl = parseNumber(total_t_ng_dl, { min: 1, max: 3000 }, 'a testosterona total (ng/dL)')
  const shbgNmol = parseNumber(shbg_nmol_l, { min: 1, max: 500 }, 'a SHBG (nmol/L)')
  const albuminGdl = parseNumber(albumin_g_dl, { min: 1, max: 7 }, 'a albumina (g/dL)')
  const tt = totalNgDl * 0.0347e-9
  const shbg = shbgNmol * 1e-9
  const albumin = (albuminGdl * 10) / ALBUMIN_MOLAR_MASS
  const n = 1 + K_ALB * albumin
  const a = n * K_SHBG
  const b = n + K_SHBG * (shbg - tt)
  const c = -tt
  const ft = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
  const ftNmol = ft * 1e9
  return {
    free_t_nmol_l: round(ftNmol, 3),
    free_t_pg_ml: round(ftNmol * 288.42, 1),
    free_t_percent: round((ft / tt) * 100, 2),
  }
}

export const unitConversions = [
  { id: 'glucose', label: 'Glicose', from: 'mg/dL', to: 'mmol/L', factor: 1 / 18.016 },
  { id: 'cholesterol', label: 'Colesterol (total, HDL, LDL)', from: 'mg/dL', to: 'mmol/L', factor: 1 / 38.67 },
  { id: 'triglycerides', label: 'Triglicerídeos', from: 'mg/dL', to: 'mmol/L', factor: 1 / 88.57 },
  { id: 'creatinine', label: 'Creatinina', from: 'mg/dL', to: 'µmol/L', factor: 88.4 },
  { id: 'testosterone', label: 'Testosterona total', from: 'ng/dL', to: 'nmol/L', factor: 0.0347 },
  { id: 'vitamin_d', label: '25-OH vitamina D', from: 'ng/mL', to: 'nmol/L', factor: 2.496 },
  { id: 'cortisol', label: 'Cortisol', from: 'µg/dL', to: 'nmol/L', factor: 27.59 },
  { id: 'calcium', label: 'Cálcio', from: 'mg/dL', to: 'mmol/L', factor: 0.2495 },
  { id: 'hba1c', label: 'HbA1c', from: '% (NGSP)', to: 'mmol/mol (IFCC)', factor: null },
]

export function convertUnit(id, value, direction = 'forward') {
  const conversion = unitConversions.find((item) => item.id === id)
  if (!conversion) throw new Error('Conversão desconhecida.')
  if (direction !== 'forward' && direction !== 'reverse') throw new Error('Direção de conversão inválida.')
  if (id === 'hba1c') {
    const number = direction === 'forward'
      ? parseNumber(value, { min: 3, max: 20 }, 'a HbA1c (%)')
      : parseNumber(value, { min: 9, max: 195 }, 'a HbA1c (mmol/mol)')
    return direction === 'forward'
      ? round((number - 2.15) * 10.929, 0)
      : round(number / 10.929 + 2.15, 1)
  }
  const number = parseNumber(value, { min: 0, max: 100000 }, 'o valor')
  return round(direction === 'forward' ? number * conversion.factor : number / conversion.factor, 2)
}

export const formulaDisclaimer =
  'Ferramenta de apoio profissional. Confirme as entradas, o método laboratorial e o contexto clínico; o cálculo isolado não define diagnóstico nem conduta.'
