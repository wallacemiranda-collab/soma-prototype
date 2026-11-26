import test from 'node:test'
import assert from 'node:assert/strict'
import { foodItems } from '../src/data/foodItems.js'
import { readFoodDiaryFlags } from '../src/config/foodDiary.js'
import {
  calculateFoodDiaryMeal,
  calculateFoodItem,
  defaultFoodDiaryPreferences,
  searchFoodItems,
  validateFoodDiaryMeal,
} from '../src/lib/foodDiary.js'

test('the curated food sample contains sourced, non-negative nutritional values', () => {
  assert.equal(foodItems.length, 4)
  for (const item of foodItems) {
    assert.ok(item.source)
    assert.ok(item.sourceCode)
    for (const value of [
      item.kcal100g,
      item.carbsTotal100g,
      item.fiber100g,
      item.protein100g,
      item.lipids100g,
    ])
      assert.ok(Number.isFinite(value) && value >= 0)
    assert.ok(item.carbsTotal100g >= item.fiber100g)
  }
})

test('manual item estimates match hand calculations from the cited TACO values', () => {
  assert.deepEqual(calculateFoodItem('taco-003', 150), {
    kcal: 192,
    carbs: 42.2,
    grams: 150,
    foodId: 'taco-003',
    name: 'Arroz, tipo 1, cozido',
  })
  assert.deepEqual(calculateFoodItem('taco-561', 100), {
    kcal: 76,
    carbs: 13.6,
    grams: 100,
    foodId: 'taco-561',
    name: 'Feijão, carioca, cozido',
  })
})

test('meal totals support total and available carbohydrate modes', () => {
  const meal = {
    items: [
      { foodId: 'taco-003', grams: 150 },
      { foodId: 'taco-561', grams: 100 },
    ],
  }
  assert.deepEqual(calculateFoodDiaryMeal(meal, 'total'), {
    kcal: 268,
    carbs: 55.8,
  })
  assert.deepEqual(calculateFoodDiaryMeal(meal, 'disponivel'), {
    kcal: 268,
    carbs: 44.9,
  })
  assert.throws(() => calculateFoodItem('taco-003', 100, 'other'))
  assert.throws(() => calculateFoodDiaryMeal(meal, 'other'))
  assert.deepEqual(
    calculateFoodDiaryMeal(
      {
        items: [
          { foodId: 'taco-003', grams: 1 },
          { foodId: 'taco-533', grams: 1 },
        ],
      },
      'total',
    ),
    { kcal: 2.4, carbs: 0.5 },
  )
})

test('food search ignores accents and matches supported aliases without inventing substitutions', () => {
  assert.equal(searchFoodItems('feijao')[0].id, 'taco-561')
  assert.equal(searchFoodItems('cuscuz nordestino')[0].id, 'taco-533')
  assert.equal(searchFoodItems('macaxeira').length, 0)
})

test('patient display defaults hide both numbers and use total carbohydrates provisionally', () => {
  assert.deepEqual(defaultFoodDiaryPreferences, {
    enabled: true,
    showCarbs: false,
    showCalories: false,
    carbMode: 'total',
  })
})

test('food diary flags keep production off by default and allow an explicit preview', () => {
  assert.deepEqual(readFoodDiaryFlags({ MODE: 'production' }), {
    enabled: false,
    previewVisible: false,
  })
  assert.equal(readFoodDiaryFlags({ DEV: true }).previewVisible, true)
  assert.equal(
    readFoodDiaryFlags({ VITE_FOOD_DIARY_ENABLED: 'true' }).previewVisible,
    true,
  )
  assert.equal(
    readFoodDiaryFlags({ VITE_FOOD_DIARY_ENABLED: 'TRUE' }).enabled,
    false,
  )
})

test('meal validation constrains records to supported fields, food and quantities', () => {
  const valid = {
    date: '2026-11-26',
    type: 'lunch',
    time: '12:30',
    items: [{ foodId: 'taco-003', grams: 150 }],
    hungerBefore: 4,
    satietyAfter: 3,
    symptoms: ['reflux'],
    note: 'Observação fictícia',
  }
  assert.deepEqual(validateFoodDiaryMeal(valid), valid)
  for (const patch of [
    { date: '2026-02-30' },
    { type: 'toString' },
    { time: '24:00' },
    { items: [{ foodId: 'not-in-the-source', grams: 100 }] },
    { items: [{ foodId: 'taco-003', grams: 0 }] },
    { hungerBefore: 6 },
    { symptoms: ['unsupported'] },
    { note: 'x'.repeat(501) },
  ])
    assert.throws(() => validateFoodDiaryMeal({ ...valid, ...patch }))
})
