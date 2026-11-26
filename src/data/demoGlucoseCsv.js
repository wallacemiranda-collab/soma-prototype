export function makeDemoGlucoseCsv({ days = 14, endDate = new Date(), timeZone = 'America/Sao_Paulo' } = {}) {
  const lines = [
    'Device,Serial Number,Device Timestamp,Record Type,Historic Glucose mg/dL,Scan Glucose mg/dL',
  ]
  const end = new Date(endDate)
  const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(end).map((part) => [part.type, part.value]))
  const endWallClock = Date.UTC(Number(dateParts.year), Number(dateParts.month) - 1, Number(dateParts.day), 23, 45)
  const total = Math.max(1, Math.min(90, days)) * 96
  const start = endWallClock - (total - 1) * 15 * 60000
  for (let index = 0; index < total; index += 1) {
    const instant = new Date(start + index * 15 * 60000)
    const time = instant.toISOString().replace('T', ' ').slice(0, 16)
    const dailyWave = Math.sin((index % 96 / 96) * Math.PI * 2)
    const slowerWave = Math.sin(index / 37) * 15
    const value = Math.max(68, Math.min(238, Math.round(139 + dailyWave * 31 + slowerWave)))
    const scanned = index % 48 === 17 ? value + 4 : ''
    lines.push(`Endo+ demo,FAKE-001,${time},${scanned ? 'Historic Glucose' : 'Historic Glucose'},${value},${scanned}`)
  }
  return lines.join('\n')
}
