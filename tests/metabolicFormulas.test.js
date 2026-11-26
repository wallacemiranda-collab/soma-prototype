import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateCkdEpi2021,
  calculateCorrectedCalcium,
  calculateFreeTestosterone,
  calculateHomaIr,
  calculateKdigoRisk,
  calculateMifflin,
  calculateTyg,
  convertUnit,
  kdigoAlbuminuriaCategory,
  kdigoGfrCategory,
  kdigoRisk,
} from '../src/lib/metabolicFormulas.js'

test('CKD-EPI 2021 reproduces hand-calculated examples', () => {
  assert.equal(calculateCkdEpi2021({ creatinine_mg_dl: 0.7, age_years: 50, sex: 'female' }).egfr_ml_min_173m2, 105)
  assert.equal(calculateCkdEpi2021({ creatinine_mg_dl: '1,0', age_years: 60, sex: 'male' }).egfr_ml_min_173m2, 86)
  assert.throws(() => calculateCkdEpi2021({ creatinine_mg_dl: 1, age_years: 60 }), /sexo/)
  assert.throws(() => calculateCkdEpi2021({ creatinine_mg_dl: 1, age_years: 17, sex: 'male' }), /idade/)
})

test('KDIGO GFR, albuminuria and risk categories follow the matrix boundaries', () => {
  assert.deepEqual([90, 89, 59, 44, 29, 14].map(kdigoGfrCategory), ['G1', 'G2', 'G3a', 'G3b', 'G4', 'G5'])
  assert.deepEqual([29, 30, 300, 301].map(kdigoAlbuminuriaCategory), ['A1', 'A2', 'A2', 'A3'])
  assert.equal(kdigoRisk('G1', 'A1'), 'low')
  assert.equal(kdigoRisk('G3a', 'A1'), 'moderate')
  assert.equal(kdigoRisk('G3b', 'A2'), 'very_high')
  assert.equal(kdigoRisk('G9', 'A1'), null)
  assert.deepEqual(calculateKdigoRisk({ egfr_ml_min_173m2: 55, acr_mg_g: 45 }), {
    gfr: 'G3a',
    albuminuria: 'A2',
    risk: 'high',
  })
  assert.throws(() => calculateKdigoRisk({ egfr_ml_min_173m2: '', acr_mg_g: 45 }), /eTFG/)
})

test('HOMA-IR, TyG and corrected calcium validate and calculate', () => {
  assert.equal(calculateHomaIr({ glucose_mg_dl: 100, insulin_uU_ml: 10 }).homa_ir, 2.47)
  assert.equal(calculateTyg({ triglycerides_mg_dl: 150, glucose_mg_dl: 100 }).tyg, 8.92)
  assert.equal(calculateCorrectedCalcium({ calcium_mg_dl: 8, albumin_g_dl: 3 }).corrected_calcium_mg_dl, 8.8)
  assert.throws(() => calculateHomaIr({ glucose_mg_dl: 100 }), /insulina/)
})

test('Mifflin-St Jeor supports both equation constants and optional activity', () => {
  assert.deepEqual(calculateMifflin({ weight_kg: 80, height_cm: 180, age_years: 30, sex: 'male', activity: 'sedentary' }), {
    bmr_kcal_day: 1780,
    tdee_kcal_day: 2136,
  })
  assert.equal(calculateMifflin({ weight_kg: 60, height_cm: 165, age_years: 40, sex: 'female' }).bmr_kcal_day, 1270)
})

test('Vermeulen estimate preserves mass balance and responds to SHBG', () => {
  const result = calculateFreeTestosterone({ total_t_ng_dl: 500, shbg_nmol_l: 40, albumin_g_dl: 4.3 })
  assert.ok(result.free_t_percent > 1.5 && result.free_t_percent < 3)
  const total = 500 * 0.0347e-9
  const free = result.free_t_nmol_l * 1e-9
  const albuminBinding = 1 + 3.6e4 * ((4.3 * 10) / 69000)
  const shbgBound = (1e9 * free * 40e-9) / (1 + 1e9 * free)
  assert.ok(Math.abs((free * albuminBinding + shbgBound - total) / total) < 0.01)
  assert.ok(calculateFreeTestosterone({ total_t_ng_dl: 500, shbg_nmol_l: 100 }).free_t_nmol_l < result.free_t_nmol_l)
})

test('unit conversion handles directions and rejects invalid HbA1c inputs', () => {
  assert.equal(convertUnit('glucose', 90), 5)
  assert.equal(convertUnit('creatinine', 1), 88.4)
  assert.equal(convertUnit('vitamin_d', 30), 74.88)
  assert.equal(convertUnit('hba1c', 7), 53)
  assert.equal(convertUnit('hba1c', 53, 'reverse'), 7)
  assert.throws(() => convertUnit('hba1c', 0), /HbA1c/)
  assert.throws(() => convertUnit('unknown', 1), /desconhecida/)
})
