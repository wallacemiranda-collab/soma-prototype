export function readFoodDiaryFlags(env = {}) {
  const enabled = env.VITE_FOOD_DIARY_ENABLED === 'true'
  return { enabled, previewVisible: enabled || env.DEV === true }
}

export const foodDiaryFlags = readFoodDiaryFlags(import.meta.env ?? {})
