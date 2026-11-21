export const heightBounds = { min: 30, max: 300 }

export const anthropometryReferences = [
  {
    title: 'OMS, relatório técnico 894, seção 2.3',
    url: 'https://iris.who.int/bitstream/handle/10665/42330/WHO_TRS_894.pdf?sequence=1',
  },
  {
    title: 'NICE NG246, medidas de cintura e altura',
    url: 'https://www.nice.org.uk/guidance/ng246/chapter/Identifying-and-assessing-overweight-obesity-and-central-adiposity',
  },
]

function valid(value, min, max) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  )
}

export function bodyMassIndex(weightKg, heightCm) {
  if (
    !valid(weightKg, 0.1, 800) ||
    !valid(heightCm, heightBounds.min, heightBounds.max)
  )
    return null
  return weightKg / (heightCm / 100) ** 2
}

export function waistHeightRatio(waistCm, heightCm) {
  if (
    !valid(waistCm, 1, 500) ||
    !valid(heightCm, heightBounds.min, heightBounds.max)
  )
    return null
  return waistCm / heightCm
}

export function entryAnthropometry(entry) {
  return {
    bmi: bodyMassIndex(entry?.weight_kg, entry?.height_cm),
    waistHeight: waistHeightRatio(entry?.waist_cm, entry?.height_cm),
  }
}

export function entryHeight(profile, existing, date, today) {
  // Never retrofit a past measurement using a height reported later.
  if (
    date === today &&
    valid(profile?.height_cm, heightBounds.min, heightBounds.max)
  )
    return profile.height_cm
  if (existing?.height_cm != null)
    return valid(existing.height_cm, heightBounds.min, heightBounds.max)
      ? existing.height_cm
      : null
  return null
}
