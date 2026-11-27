const PORTUGUESE_MARKERS = [
  'relatorio agp',
  'tempo dentro dos intervalos',
]
const ENGLISH_MARKERS = [
  'agp report',
  'time in ranges',
]

export const LIBREVIEW_PDF_MAX_BYTES = 10_000_000

const MONTHS = {
  jan: 1, january: 1, janeiro: 1,
  feb: 2, february: 2, fev: 2, fevereiro: 2,
  mar: 3, march: 3, marco: 3,
  apr: 4, april: 4, abr: 4, abril: 4,
  may: 5, mai: 5, maio: 5,
  jun: 6, june: 6, junho: 6,
  jul: 7, july: 7, julho: 7,
  aug: 8, august: 8, ago: 8, agosto: 8,
  sep: 9, sept: 9, september: 9, set: 9, setembro: 9,
  oct: 10, october: 10, out: 10, outubro: 10,
  nov: 11, november: 11, novembro: 11,
  dec: 12, december: 12, dez: 12, dezembro: 12,
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\uE000-\uF8FF]/g, '-')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function point(item, width, height) {
  return {
    item,
    x: (Number(item.transform?.[4]) / width) * 612,
    y: (Number(item.transform?.[5]) / height) * 792,
    width: (Number(item.width) / width) * 612,
    text: String(item.str ?? '').trim(),
  }
}

function groupLines(items, width, height) {
  const fragments = items
    .map((item) => point(item, width, height))
    .filter((entry) => entry.text)
    .sort((a, b) => b.y - a.y || a.x - b.x)
  const lines = []
  for (const fragment of fragments) {
    let line = lines.find((candidate) => Math.abs(candidate.y - fragment.y) <= 2)
    if (!line) {
      line = { y: fragment.y, fragments: [] }
      lines.push(line)
    }
    line.fragments.push(fragment)
  }
  return lines
    .map((line) => ({
      y: line.y,
      fragments: line.fragments.sort((a, b) => a.x - b.x),
      text: line.fragments.sort((a, b) => a.x - b.x).map((part) => part.text).join(' '),
    }))
    .sort((a, b) => b.y - a.y)
}

function parseMonthToken(value) {
  return MONTHS[normalizeText(value).replace(/\.$/, '')] ?? null
}

function dateTokens(line) {
  const monthNames = Object.keys(MONTHS).join('|')
  const pattern = new RegExp(
    `(?:(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(\\d{4})|(\\d{1,2})\\s+(${monthNames})\\.?\\s+(\\d{4}))`,
    'gi',
  )
  return [...line.matchAll(pattern)].map((match) => {
    const month = parseMonthToken(match[1] ?? match[5])
    const day = Number(match[2] ?? match[4])
    const year = Number(match[3] ?? match[6])
    if (!month || day < 1 || day > 31 || year < 2000 || year > 2100) return null
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
    return date.toISOString().slice(0, 10)
  }).filter(Boolean)
}

function findPeriod(lines) {
  for (const line of lines) {
    const normalized = normalizeText(line.text)
    if (!/\b(?:dias|days)(?=\s|\d|$)/.test(normalized)) continue
    const dates = dateTokens(line.text)
    if (dates.length !== 2 || dates[0] > dates[1]) continue
    const duration = (Date.parse(`${dates[1]}T00:00:00Z`) - Date.parse(`${dates[0]}T00:00:00Z`)) / 86400000
    if (duration < 0 || duration > 366) continue
    return { start: dates[0], end: dates[1] }
  }
  return null
}

function numericToken(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,3}(?:[.,]\d+)?)(?:\s*%)?$/)
  if (!match) return null
  const number = Number(match[1].replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

function hasPercentUnit(candidate, points) {
  if (/%/.test(candidate.text)) return true
  const right = candidate.x + (candidate.width || 0)
  return points.some((point) => point.text === '%'
    && Math.abs(point.y - candidate.y) <= 2.5
    && point.x >= right - 2
    && point.x <= right + 14)
}

function findAnchor(points, labels, minX = 0) {
  const normalizedLabels = labels.map(normalizeText)
  return points.find((point) => {
    const text = normalizeText(point.text)
    return point.x >= minX && normalizedLabels.some((label) =>
      text === label || (label.length >= 18 && text.includes(label)))
  }) ?? null
}

function findNumber(points, {
  minX,
  maxX,
  minY,
  maxY,
  expectedX,
  expectedY,
  percent = false,
}) {
  const candidates = points
    .map((point) => ({ ...point, value: numericToken(point.text) }))
    .filter((point) => point.value !== null
      && point.x >= minX && point.x <= maxX
      && point.y >= minY && point.y <= maxY
      && (!percent || hasPercentUnit(point, points)))
    .sort((a, b) => (Math.abs(a.x - expectedX) + 2 * Math.abs(a.y - expectedY))
      - (Math.abs(b.x - expectedX) + 2 * Math.abs(b.y - expectedY)))
  return candidates[0]?.value ?? null
}

function percentNear(points, anchor, band, yOffset) {
  if (!anchor) return null
  return findNumber(points, {
    minX: anchor.x + band[0],
    maxX: anchor.x + band[1],
    minY: anchor.y + yOffset[0],
    maxY: anchor.y + yOffset[1],
    expectedX: anchor.x + (band[0] + band[1]) / 2,
    expectedY: anchor.y + (yOffset[0] + yOffset[1]) / 2,
    percent: true,
  })
}

function deviceName(text) {
  if (!/\b(?:dispositivo|device)(?:\s*\(s\))?(?=\s|$)/i.test(text)) return null
  const match = text.match(/\bFreeStyle\s+Libre(?:\s*(?:Link|[23](?:\s+Plus)?))?\b/i)
  if (!match) return null
  const value = normalizeText(match[0]).replace(/\s+/g, ' ')
  if (value.includes('librelink')) return 'FreeStyle LibreLink'
  if (value.includes('libre 3 plus')) return 'FreeStyle Libre 3 Plus'
  if (value.includes('libre 3')) return 'FreeStyle Libre 3'
  if (value.includes('libre 2')) return 'FreeStyle Libre 2'
  return 'FreeStyle Libre'
}

function validMetrics(metrics) {
  const percentages = [
    metrics.sensorActivePercent,
    metrics.timeVeryHighPercent,
    metrics.timeHighPercent,
    metrics.timeInRangePercent,
    metrics.timeLowPercent,
    metrics.timeVeryLowPercent,
  ]
  if (percentages.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) return false
  const rangeTotal = percentages.slice(1).reduce((total, value) => total + value, 0)
  return rangeTotal >= 97 && rangeTotal <= 103
    && metrics.meanGlucoseMgDl >= 20 && metrics.meanGlucoseMgDl <= 1000
    && metrics.gmiPercent > 0 && metrics.gmiPercent <= 20
    && metrics.gmiMmolMol >= 0 && metrics.gmiMmolMol <= 300
    && metrics.coefficientVariationPercent >= 0 && metrics.coefficientVariationPercent <= 200
    && Boolean(metrics.periodStart && metrics.periodEnd && metrics.device)
}

export function parseLibreViewAgpPage(items, pageBounds) {
  const width = Number(pageBounds?.[2]) - Number(pageBounds?.[0])
  const height = Number(pageBounds?.[3]) - Number(pageBounds?.[1])
  if (!Array.isArray(items) || width < 550 || width > 700 || height < 700 || height > 900) {
    return { status: 'unrecognized', metrics: null, parserVersion: 'libreview-agp-text-v1' }
  }

  const points = items.map((item) => point(item, width, height)).filter((point) => point.text)
  const lines = groupLines(items, width, height)
  const pageText = points.map((point) => point.text).join(' ')
  const normalized = normalizeText(pageText)
  const portuguese = PORTUGUESE_MARKERS.every((marker) => normalized.includes(marker))
  const english = ENGLISH_MARKERS.every((marker) => normalized.includes(marker))
  if (!portuguese && !english) {
    return { status: 'unrecognized', metrics: null, parserVersion: 'libreview-agp-text-v1' }
  }

  const labels = portuguese
    ? {
      sensor: ['tempo ativo do sensor'], ranges: ['tempo dentro dos intervalos'],
      veryHigh: ['muito alto'], high: ['alta'], target: ['alvo'], low: ['baixa'], veryLow: ['muito baixo'],
      mean: ['media de glicose'], gmi: ['indicador de gerenciamento da glicose'], cv: ['variabilidade da glicose'],
    }
    : {
      sensor: ['sensor active'], ranges: ['time in ranges'],
      veryHigh: ['very high'], high: ['high'], target: ['target'], low: ['low'], veryLow: ['very low'],
      mean: ['average glucose'], gmi: ['glucose management indicator'], cv: ['glucose variability'],
    }
  const sensorAnchor = findAnchor(points, labels.sensor, 250)
  const veryHighAnchor = findAnchor(points, labels.veryHigh, 75)
  const highAnchor = findAnchor(points, labels.high, 75)
  const targetAnchor = findAnchor(points, labels.target, 75)
  const lowAnchor = findAnchor(points, labels.low, 75)
  const veryLowAnchor = findAnchor(points, labels.veryLow, 75)
  const meanAnchor = findAnchor(points, labels.mean, 280)
  const gmiAnchor = findAnchor(points, labels.gmi, 280)
  const cvAnchor = findAnchor(points, labels.cv, 280)

  const metrics = {
    language: portuguese ? 'pt' : 'en',
    periodStart: findPeriod(lines)?.start ?? null,
    periodEnd: findPeriod(lines)?.end ?? null,
    sensorActivePercent: percentNear(points, sensorAnchor, [70, 150], [-5, 5]),
    timeVeryHighPercent: percentNear(points, veryHighAnchor, [35, 105], [-9, 2]),
    timeHighPercent: percentNear(points, highAnchor, [35, 105], [-5, 3]),
    timeInRangePercent: percentNear(points, targetAnchor, [145, 200], [-14, 2]),
    timeLowPercent: percentNear(points, lowAnchor, [35, 105], [-5, 3]),
    timeVeryLowPercent: percentNear(points, veryLowAnchor, [35, 105], [-10, 2]),
    meanGlucoseMgDl: meanAnchor ? findNumber(points, {
      minX: meanAnchor.x + 145, maxX: meanAnchor.x + 280,
      minY: meanAnchor.y - 15, maxY: meanAnchor.y + 4,
      expectedX: meanAnchor.x + 205, expectedY: meanAnchor.y - 9,
    }) : null,
    gmiPercent: gmiAnchor ? findNumber(points, {
      minX: gmiAnchor.x - 6, maxX: gmiAnchor.x + 32,
      minY: gmiAnchor.y - 27, maxY: gmiAnchor.y - 7,
      expectedX: gmiAnchor.x + 2, expectedY: gmiAnchor.y - 18,
      percent: true,
    }) : null,
    gmiMmolMol: gmiAnchor ? findNumber(points, {
      minX: gmiAnchor.x + 68, maxX: gmiAnchor.x + 145,
      minY: gmiAnchor.y - 27, maxY: gmiAnchor.y - 7,
      expectedX: gmiAnchor.x + 100, expectedY: gmiAnchor.y - 18,
    }) : null,
    coefficientVariationPercent: cvAnchor ? findNumber(points, {
      minX: cvAnchor.x + 165, maxX: cvAnchor.x + 285,
      minY: cvAnchor.y - 24, maxY: cvAnchor.y - 3,
      expectedX: cvAnchor.x + 220, expectedY: cvAnchor.y - 14,
      percent: true,
    }) : null,
    device: deviceName(pageText),
  }
  if (!labels.ranges.some((label) => normalized.includes(label)) || !validMetrics(metrics)) {
    return {
      status: 'unrecognized',
      metrics: null,
      missingFields: Object.entries(metrics).filter(([, value]) => value === null).map(([key]) => key),
      parserVersion: 'libreview-agp-text-v1',
    }
  }
  return { status: 'recognized', metrics, parserVersion: 'libreview-agp-text-v1' }
}

