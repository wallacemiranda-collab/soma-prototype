import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { localDate } from '../lib/patientData.js'
import {
  defaultFoodDiaryPreferences,
  validateFoodDiaryMeal,
} from '../lib/foodDiary.js'

const FoodDiaryPreviewContext = createContext(null)

function initialPreview() {
  const date = localDate()
  return {
    preferences: { ...defaultFoodDiaryPreferences },
    meals: [
      {
        id: 'demo-breakfast',
        date,
        type: 'breakfast',
        time: '08:00',
        items: [
          { foodId: 'taco-182', grams: 70 },
          { foodId: 'taco-003', grams: 50 },
        ],
        hungerBefore: 3,
        satietyAfter: 4,
        symptoms: [],
        note: '',
      },
      {
        id: 'demo-lunch',
        date,
        type: 'lunch',
        time: '12:30',
        items: [
          { foodId: 'taco-003', grams: 150 },
          { foodId: 'taco-561', grams: 100 },
        ],
        hungerBefore: 4,
        satietyAfter: 4,
        symptoms: [],
        note: '',
      },
    ],
  }
}

export function FoodDiaryPreviewProvider({ children }) {
  const [preview, setPreview] = useState(initialPreview)

  const updatePreferences = useCallback((patch) => {
    setPreview((current) => ({
      ...current,
      preferences: { ...current.preferences, ...patch },
    }))
  }, [])

  const addMeal = useCallback((value) => {
    const meal = validateFoodDiaryMeal(value)
    const id = `demo-meal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setPreview((current) => ({
      ...current,
      meals: [...current.meals, { ...meal, id }],
    }))
  }, [])

  const removeMeal = useCallback((id) => {
    setPreview((current) => ({
      ...current,
      meals: current.meals.filter((meal) => meal.id !== id),
    }))
  }, [])

  const value = useMemo(
    () => ({ ...preview, updatePreferences, addMeal, removeMeal }),
    [preview, updatePreferences, addMeal, removeMeal],
  )
  return (
    <FoodDiaryPreviewContext.Provider value={value}>
      {children}
    </FoodDiaryPreviewContext.Provider>
  )
}

export function useFoodDiaryPreview() {
  const context = useContext(FoodDiaryPreviewContext)
  if (!context)
    throw new Error('useFoodDiaryPreview must be used within its provider')
  return context
}
