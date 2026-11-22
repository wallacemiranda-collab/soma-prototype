import { defineConfig } from '@playwright/test'
import base from './playwright.config.js'
import { loadStagingConfig } from './tests/staging/support.mjs'

const staging = loadStagingConfig()

export default defineConfig({
  ...base,
  testDir: './tests/staging-browser',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  globalTimeout: 240000,
  outputDir: './test-results-staging',
  use: {
    ...base.use,
    baseURL: 'http://127.0.0.1:4178',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: {
    ...base.webServer,
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4178 --strictPort`,
    url: 'http://127.0.0.1:4178',
    env: {
      VITE_SUPABASE_URL: staging.url,
      VITE_SUPABASE_ANON_KEY: staging.publishable_key,
      VITE_CLINICAL_PREVIEW_ENABLED: 'false',
      VITE_CLINICAL_INTEGRATION_ENABLED: 'true',
      VITE_GOOGLE_AUTH_ENABLED: 'false',
      VITE_HOMOLOGATION_ENABLED: 'true',
      VITE_REMINDERS_HOMOLOGATION_ENABLED: 'true',
    },
  },
})
