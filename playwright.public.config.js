import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/public',
  workers: 1,
  timeout: 60000,
  globalTimeout: 120000,
  outputDir: 'test-results-public',
  reporter: 'list',
  use: {
    baseURL: process.env.ENDO_PUBLIC_URL || 'https://endo-plus.vercel.app',
    viewport: { width: 390, height: 844 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    },
  },
})
