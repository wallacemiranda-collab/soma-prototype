const HEADER_ALIASES = {
  date: ['device timestamp', 'timestamp', 'data e hora', 'data/hora', 'date time', 'date'],
  type: ['record type', 'tipo de registro', 'tipo'],
  historic: ['historic glucose mg/dl', 'historic glucose mmol/l', 'historic glucose', 'glicose historica mg/dl', 'glicose historica mmol/l', 'historic glucose value'],
  scan: ['scan glucose mg/dl', 'scan glucose mmol/l', 'scan glucose', 'glicose escaneada mg/dl', 'glicose escaneada mmol/l'],
  value: ['glucose mg/dl', 'glucose mmol/l', 'glicose mg/dl', 'glicose mmol/l', 'glucose value', 'valor da glicose'],
  unit: ['unit', 'units', 'unidade', 'glucose unit'],
}

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function splitCsvLine(line, delimiter) {
  const values = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"'
        i += 1
      } else quoted = !quoted
    } else if (char === delimiter && !quoted) {
      values.push(value.trim())
      value = ''
    } else value += char
  }
  if (quoted) throw new Error('O CSV contém aspas incompletas.')
  values.push(value.trim())
  return values
}

function findDelimiter(headerLine) {
  const commas = splitCsvLine(headerLine, ',').length
  const semicolons = splitCsvLine(headerLine, ';').length
  return semicolons > commas ? ';' : ','
}

function dateValue(value, timeZone) {
  const input = String(value ?? '').trim()
  const iso = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  const br = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  let parts
  if (iso) parts = [Number(iso[1]), Number(iso[2]), Number(iso[3]), Number(iso[4] ?? 0), Number(iso[5] ?? 0), Number(iso[6] ?? 0)]
  else if (br) parts = [Number(br[3]), Number(br[2]), Number(br[1]), Number(br[4] ?? 0), Number(br[5] ?? 0), Number(br[6] ?? 0)]
  else return null
  const [year, month, day, hour, minute, second] = parts
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second)
  const check = new Date(wallClock)
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return null
  try {
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
      const observedWallClock = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
      instant += wallClock - observedWallClock
    }
    return new Date(instant).toISOString()
  } catch {
    throw new Error('Informe um fuso horário válido, por exemplo America/Sao_Paulo.')
  }
}

function numeric(value) {
  const result = Number(String(value ?? '').trim().replace(',', '.'))
  return Number.isFinite(result) && result > 0 && result <= 1000 ? result : null
}

function headerIndex(headers, names) {
  return headers.findIndex((header) => names.includes(header))
}

export function parseLibreViewCsv(text, { timeZone = 'America/Sao_Paulo' } = {}) {
  if (typeof text !== 'string' || text.length > 5_000_000)
    throw new Error('Arquivo CSV vazio ou maior que 5 MB.')
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) throw new Error('O arquivo não contém linhas de glicose.')
  const delimiter = findDelimiter(lines[0])
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader)
  const dateColumn = headerIndex(headers, HEADER_ALIASES.date)
  const typeColumn = headerIndex(headers, HEADER_ALIASES.type)
  const historicColumn = headerIndex(headers, HEADER_ALIASES.historic)
  const scanColumn = headerIndex(headers, HEADER_ALIASES.scan)
  const valueColumn = headerIndex(headers, HEADER_ALIASES.value)
  const unitColumn = headerIndex(headers, HEADER_ALIASES.unit)
  if (dateColumn < 0 || (historicColumn < 0 && scanColumn < 0 && valueColumn < 0))
    throw new Error('Não reconhecemos este formato de CSV. Exporte “Dados de glicose” no LibreView e tente novamente.')

  const version = historicColumn >= 0 || scanColumn >= 0 ? 'libreview-glucose-v1' : 'compatible-glucose-csv-v1'
  const rows = []
  for (const line of lines.slice(1)) {
    const columns = splitCsvLine(line, delimiter)
    const occurredAt = dateValue(columns[dateColumn], timeZone)
    if (!occurredAt) continue
    const unitFromHeader = headers[historicColumn >= 0 ? historicColumn : scanColumn >= 0 ? scanColumn : valueColumn] ?? ''
    const sourceUnit = /mmol/i.test(unitFromHeader) || /mmol/i.test(columns[unitColumn] ?? '') ? 'mmol/L' : 'mg/dL'
    const recordType = normalizeHeader(columns[typeColumn] ?? '')
    const fields = []
    if (historicColumn >= 0 && columns[historicColumn]) fields.push(['automatic', columns[historicColumn]])
    if (scanColumn >= 0 && columns[scanColumn]) fields.push(['scanned', columns[scanColumn]])
    if (!fields.length && valueColumn >= 0 && columns[valueColumn]) {
      const scanned = /scan|escane|historic|autom|sensor/i.test(recordType)
      fields.push([/scan|escane/i.test(recordType) ? 'scanned' : scanned ? 'automatic' : 'unknown', columns[valueColumn]])
    }
    for (const [kind, rawValue] of fields) {
      const parsed = numeric(rawValue)
      if (!parsed) continue
      const mgDl = sourceUnit === 'mmol/L' ? parsed * 18.0182 : parsed
      if (mgDl < 20 || mgDl > 1000) continue
      rows.push({
        occurredAt,
        valueMgDl: Math.round(mgDl * 10) / 10,
        originalValue: parsed,
        originalUnit: sourceUnit,
        kind: kind === 'unknown' && /historic|autom/i.test(recordType) ? 'automatic' : kind,
        timeZone,
      })
    }
  }
  if (!rows.length) throw new Error('Não encontramos leituras válidas nesse CSV.')
  return { format: version, delimiter, timeZone, readings: deduplicateReadings(rows) }
}

export function deduplicateReadings(readings) {
  const unique = new Map()
  for (const row of readings)
    unique.set(`${row.occurredAt}|${row.kind}|${row.valueMgDl}`, row)
  return [...unique.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
}

export function mergeGlucoseImports(previous, next) {
  if (!next?.readings?.length) return previous
  if (!previous?.readings?.length) return next
  return {
    ...next,
    filename: `${previous.filename ?? 'arquivo anterior'} + ${next.filename ?? 'arquivo novo'}`,
    readings: deduplicateReadings([...previous.readings, ...next.readings]),
  }
}

export function calculateCgmMetrics(readings, {
  start,
  end,
  expectedIntervalMinutes = 15,
  targets = { low: 70, high: 180, veryLow: 54, veryHigh: 250 },
} = {}) {
  const from = Date.parse(start)
  const to = Date.parse(end)
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from)
    throw new Error('Selecione um período válido.')
  if (!Number.isFinite(expectedIntervalMinutes) || expectedIntervalMinutes < 5 || expectedIntervalMinutes > 1440)
    throw new Error('O intervalo esperado deve ficar entre 5 e 1.440 minutos.')
  const values = readings
    .filter((row) => row.kind === 'automatic' && Date.parse(row.occurredAt) >= from && Date.parse(row.occurredAt) <= to)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  const expectedSamples = Math.floor((to - from) / (expectedIntervalMinutes * 60000)) + 1
  const wearPercent = Math.min(100, (new Set(values.map((row) => row.occurredAt)).size / expectedSamples) * 100)
  if (wearPercent < 70 || !values.length) return { sufficient: false, wearPercent, readings: values.length }
  const mean = values.reduce((total, row) => total + row.valueMgDl, 0) / values.length
  const variance = values.reduce((total, row) => total + (row.valueMgDl - mean) ** 2, 0) / values.length
  const percent = (condition) => (values.filter((row) => condition(row.valueMgDl)).length / values.length) * 100
  return {
    sufficient: true,
    wearPercent,
    readings: values.length,
    meanMgDl: mean,
    gmi: 3.31 + 0.02392 * mean,
    coefficientOfVariation: (Math.sqrt(variance) / mean) * 100,
    timeInRange: percent((value) => value >= targets.low && value <= targets.high),
    belowRange: percent((value) => value < targets.low),
    below54: percent((value) => value < targets.veryLow),
    aboveRange: percent((value) => value > targets.high),
    above250: percent((value) => value > targets.veryHigh),
    automaticReadings: values,
  }
}

export function agpByHour(readings) {
  const buckets = Array.from({ length: 24 }, () => [])
  for (const row of readings) {
    if (row.kind !== 'automatic' || !Number.isFinite(row.valueMgDl)) continue
    let hour = new Date(row.occurredAt).getUTCHours()
    try {
      hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: row.timeZone || 'UTC', hour: '2-digit', hourCycle: 'h23' }).format(new Date(row.occurredAt)))
    } catch {
      hour = new Date(row.occurredAt).getUTCHours()
    }
    buckets[hour % 24].push(row.valueMgDl)
  }
  const quantile = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))] : null
  return buckets.map((values, hour) => {
    const sorted = [...values].sort((a, b) => a - b)
    return { hour, count: sorted.length, p5: quantile(sorted, 0.05), p25: quantile(sorted, 0.25), median: quantile(sorted, 0.5), p75: quantile(sorted, 0.75), p95: quantile(sorted, 0.95) }
  })
}
