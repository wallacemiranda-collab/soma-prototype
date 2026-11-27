import test from 'node:test'
import assert from 'node:assert/strict'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { parseLibreViewAgpPage } from '../src/lib/libreviewAgpPdfCore.js'

function makeTextPdf(lines) {
  const draw = lines.map(({ x, y, text }) =>
    `BT /F1 10 Tf 1 0 0 1 ${x} ${y} Tm (${String(text).replace(/[\\()]/g, '\\$&')}) Tj ET`,
  ).join('\n')
  const stream = Buffer.from(draw, 'latin1')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]
  const chunks = [Buffer.from('%PDF-1.4\n', 'latin1')]
  const offsets = [0]
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.concat(chunks).length)
    chunks.push(Buffer.from(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`, 'latin1'))
  }
  offsets.push(Buffer.concat(chunks).length)
  chunks.push(Buffer.from(`5 0 obj\n<< /Length ${stream.length} >>\nstream\n`, 'latin1'), stream, Buffer.from('\nendstream\nendobj\n', 'latin1'))
  const xrefOffset = Buffer.concat(chunks).length
  const xref = ['xref', '0 6', '0000000000 65535 f ', ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `)].join('\n')
  chunks.push(Buffer.from(`${xref}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`, 'latin1'))
  return Buffer.concat(chunks)
}

async function parseSynthetic(lines) {
  const task = getDocument({ data: new Uint8Array(makeTextPdf(lines)), disableFontFace: true })
  try {
    const document = await task.promise
    const page = await document.getPage(1)
    const content = await page.getTextContent()
    return parseLibreViewAgpPage(content.items, page.view)
  } finally {
    await task.destroy()
  }
}

function reportLines(language, { active = 63, inRange = 78 } = {}) {
  const pt = language === 'pt'
  const lines = [
    { x: 40, y: 698, text: pt ? 'Relatório AGP' : 'AGP Report' },
    { x: 45, y: 670, text: pt ? '14 Dias' : '14 Days' },
    { x: 79, y: 670, text: pt ? '13 set 2025 - 26 set 2025' : 'Sep 13, 2025 - Sep 26, 2025' },
    { x: 317, y: 670, text: pt ? 'Tempo ativo do sensor' : 'Sensor Active' },
    { x: 440, y: 670, text: `${active}%` },
    { x: 47, y: 640, text: pt ? 'Tempo dentro dos intervalos' : 'Time in Ranges' },
    { x: 114, y: 621, text: pt ? 'Muito alto' : 'Very High' },
    { x: 177, y: 615, text: '2%' },
    { x: 114, y: 591, text: pt ? 'Alta' : 'High' },
    { x: 177, y: 590, text: '8%' },
    { x: 114, y: 559, text: pt ? 'Alvo' : 'Target' },
    { x: 272, y: 551, text: `${inRange}%` },
    { x: 114, y: 516, text: pt ? 'Baixa' : 'Low' },
    { x: 177, y: 514, text: '10%' },
    { x: 114, y: 496, text: pt ? 'Muito baixo' : 'Very Low' },
    { x: 177, y: 489, text: '2%' },
    { x: 319, y: 610, text: pt ? 'Média de Glicose' : 'Average Glucose' },
    { x: 518, y: 601, text: '145' },
    { x: 545, y: 601, text: 'mg/dL' },
    { x: 319, y: 563, text: pt ? 'Indicador de gerenciamento da glicose (GMI)' : 'Glucose Management Indicator (GMI)' },
    { x: 319, y: 545, text: '6.7%' },
    { x: 414, y: 545, text: '50' },
    { x: 434, y: 545, text: 'mmol/mol' },
    { x: 319, y: 515, text: pt ? 'Variabilidade da glicose' : 'Glucose Variability' },
    { x: 524, y: 501, text: '34.5%' },
    { x: 430, y: 100, text: `Device(s) FreeStyle Libre 3` },
  ]
  return lines
}

test('reads Portuguese LibreView AGP summary text and ignores identifiable fields', async () => {
  const parsed = await parseSynthetic(reportLines('pt'))
  assert.equal(parsed.status, 'recognized')
  assert.equal(parsed.parserVersion, 'libreview-agp-text-v1')
  assert.deepEqual(parsed.metrics, {
    language: 'pt',
    periodStart: '2025-09-13',
    periodEnd: '2025-09-26',
    sensorActivePercent: 63,
    timeVeryHighPercent: 2,
    timeHighPercent: 8,
    timeInRangePercent: 78,
    timeLowPercent: 10,
    timeVeryLowPercent: 2,
    meanGlucoseMgDl: 145,
    gmiPercent: 6.7,
    gmiMmolMol: 50,
    coefficientVariationPercent: 34.5,
    device: 'FreeStyle Libre 3',
  })
  assert.equal('name' in parsed.metrics, false)
  assert.equal('birthDate' in parsed.metrics, false)
})

test('reads English LibreView AGP summary text and retains low-wear metrics', async () => {
  const parsed = await parseSynthetic(reportLines('en', { active: 68 }))
  assert.equal(parsed.status, 'recognized')
  assert.equal(parsed.metrics.language, 'en')
  assert.equal(parsed.metrics.sensorActivePercent, 68)
  assert.equal(parsed.metrics.timeInRangePercent, 78)
  assert.equal(parsed.metrics.meanGlucoseMgDl, 145)
})

test('unrecognized, incomplete and inconsistent layouts fail closed', async () => {
  assert.equal((await parseSynthetic([{ x: 40, y: 698, text: 'LibreView export' }])).status, 'unrecognized')
  assert.equal((await parseSynthetic(reportLines('pt').filter((line) => line.x !== 518))).status, 'unrecognized')
  assert.equal((await parseSynthetic(reportLines('en', { inRange: 91 }))).status, 'unrecognized')
})
