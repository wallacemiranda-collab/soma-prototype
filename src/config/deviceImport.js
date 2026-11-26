export const deviceImportEnabled =
  import.meta.env.VITE_DEVICE_IMPORT_ENABLED === 'true'

export const deviceImportVisible = deviceImportEnabled || import.meta.env.DEV === true

export const cgmConsentVersion = 'cgm-import-demo-v1'

export const defaultGlucoseTargets = {
  low: 70,
  high: 180,
  veryLow: 54,
  veryHigh: 250,
}

export function localDayBoundary(day, timeZone, endOfDay = false) {
  const time = endOfDay ? '23:59:00' : '00:00:00'
  const input = `${day} ${time}`
  const parsed = dateValue(input, timeZone)
  return parsed ? Date.parse(parsed) : Number.NaN
}

function dateValue(value, timeZone) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return null
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number)
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  let instant = wallClock
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, Number(part.value)]))
    instant += wallClock - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  }
  return new Date(instant).toISOString()
}
