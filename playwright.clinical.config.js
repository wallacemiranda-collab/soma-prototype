import { defineConfig } from '@playwright/test'
import base from './playwright.config.js'

export default defineConfig({
  ...base,
  testDir: './tests/clinical-browser',
  globalTimeout: 240000,
  use: { ...base.use, trace: 'off', screenshot: 'off' },
  webServer: {
    ...base.webServer,
    env: { ...base.webServer.env, VITE_CLINICAL_PREVIEW_ENABLED: 'true' },
  },
})
