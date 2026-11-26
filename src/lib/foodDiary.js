import { foodItems } from '../data/foodItems.js'

export const mealTypes = [
  { id: 'breakfast', label: 'Café da manhã' },
  { id: 'morning_snack', label: 'Lanche da manhã' },
  { id: 'lunch', label: 'Almoço' },
  { id: 'afternoon_snack', label: 'Lanche da tarde' },
  { id: 'dinner', label: 'Jantar' },
  { id: 'supper', label: 'Ceia' },
  { id: 'other', label: 'Outro' },
]

export const defaultFoodDiaryPreferences = Object.freeze({
  enabled: true,
  showCarbs: false,
  showCalories: false,
  carbMode: 'total',
})

export const symptomOptions = [
  { id: 'nausea', label: 'Náusea' },
  { id: 'fullness', label: 'Empachamento' },
  { id: 'reflux', label: 'Refluxo' },
  { id: 'abdominal_pain', label: 'Dor abdominal' },
  { id: 'diarrhea', label: 'Diarreia' },
  { id: 'constipation', label: 'Constipação' },
]

function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

function rounded(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10
}

function calendarDateIsValid(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

export function searchFoodItems(query) {
  const term = normalizeSearch(query)
  if (!term) return foodItems
  return foodItems.filter((food) =>
    [food.name, ...food.aliases].some((label) =>
      normalizeSearch(label).includes(term),
    ),
  )
}

function rawFoodEstimate(item, grams, carbMode) {
  const amount = Number(grams)
  const carbsPer100g =
    carbMode === 'total'
      ? item.carbsTotal100g
      : item.carbsTotal100g - item.fiber100g
  return {
    kcal: (item.kcal100g * amount) / 100,
    carbs: (carbsPer100g * amount) / 100,
  }
}

export function calculateFoodItem(foodId, grams, carbMode = 'total') {
  const item = foodItems.find((food) => food.id === foodId)
  const amount = Number(grams)
  if (!item || !Number.isFinite(amount) || amount <= 0 || amount > 2000)
    throw new Error('Confira o alimento e a quantidade informada.')
  if (!['total', 'disponivel'].includes(carbMode))
    throw new Error('Modo de carboidratos inválido.')

  const estimate = rawFoodEstimate(item, amount, carbMode)
  return {
    kcal: rounded(estimate.kcal),
    carbs: rounded(estimate.carbs),
    grams: amount,
    foodId: item.id,
    name: item.name,
  }
}

export function calculateFoodDiaryMeal(meal, carbMode = 'total') {
  if (!meal || !Array.isArray(meal.items) || meal.items.length === 0)
    throw new Error('Adicione ao menos um alimento à refeição.')
  if (!['total', 'disponivel'].includes(carbMode))
    throw new Error('Modo de carboidratos inválido.')
  const totals = meal.items.reduce(
    (sum, item) => {
      const food = foodItems.find(({ id }) => id === item.foodId)
      if (!food) throw new Error('O alimento não existe na base desta prévia.')
      const result = rawFoodEstimate(food, item.grams, carbMode)
      if (!Number.isFinite(Number(item.grams)) || Number(item.grams) <= 0 || Number(item.grams) > 2000)
        throw new Error('Confira a quantidade informada para este alimento.')
      sum.kcal += result.kcal
      sum.carbs += result.carbs
      return sum
    },
    { kcal: 0, carbs: 0 },
  )
  return { kcal: rounded(totals.kcal), carbs: rounded(totals.carbs) }
}

export function validateFoodDiaryMeal(value) {
  const date = String(value?.date ?? '')
  const parsedDate = new Date(`${date}T12:00:00`)
  if (!calendarDateIsValid(date)) throw new Error('Informe uma data válida.')
  if (!mealTypes.some(({ id }) => id === value?.type))
    throw new Error('Selecione o tipo de refeição.')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value?.time ?? '')))
    throw new Error('Informe um horário válido.')
  if (!Array.isArray(value?.items) || value.items.length < 1 || value.items.length > 12)
    throw new Error('Adicione de 1 a 12 alimentos.')

  const items = value.items.map((item) => {
    const result = calculateFoodItem(item?.foodId, item?.grams)
    return { foodId: result.foodId, grams: result.grams }
  })
  for (const key of ['hungerBefore', 'satietyAfter']) {
    if (!Number.isInteger(value[key]) || value[key] < 1 || value[key] > 5)
      throw new Error('Escolha uma opção de 1 a 5 para fome e saciedade.')
  }
  const symptoms = value.symptoms ?? []
  if (
    !Array.isArray(symptoms) ||
    symptoms.some((item) => !symptomOptions.some(({ id }) => id === item))
  )
    throw new Error('Revise os sintomas selecionados.')
  const note = String(value.note ?? '')
  if (note.length > 500) throw new Error('A observação deve ter até 500 caracteres.')

  return {
    date,
    type: value.type,
    time: value.time,
    items,
    hungerBefore: value.hungerBefore,
    satietyAfter: value.satietyAfter,
    symptoms: [...new Set(symptoms)],
    note,
  }
}
