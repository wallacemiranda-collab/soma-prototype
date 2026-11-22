import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const root = resolve(process.argv[2] || '.')
const svg = readFileSync(resolve(root, 'public/endo-plus-symbol.svg'), 'utf8')
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
})
try {
  const page = await browser.newPage()
  await page.setContent('<!doctype html><canvas></canvas>')
  mkdirSync(resolve(root, 'public/icons'), { recursive: true })
  for (const size of [180, 192, 512]) {
    const data = await page.evaluate(
      async ({ svg, size }) => {
        const canvas = document.querySelector('canvas')
        canvas.width = canvas.height = size
        const context = canvas.getContext('2d')
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, size, size)
        const icon = new Image()
        icon.src = 'data:image/svg+xml;base64,' + btoa(svg)
        await icon.decode()
        context.drawImage(
          icon,
          size * 0.16,
          size * 0.16,
          size * 0.68,
          size * 0.68,
        )
        return canvas.toDataURL('image/png')
      },
      { svg, size },
    )
    writeFileSync(
      resolve(root, `public/icons/endo-preview-${size}.png`),
      Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'),
    )
  }
  console.log('Generated three preview icons from the existing vector mark.')
} finally {
  await browser.close()
}
