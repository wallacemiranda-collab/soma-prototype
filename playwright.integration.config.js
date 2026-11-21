import { defineConfig } from '@playwright/test'
import base from './playwright.config.js'

export default defineConfig({
  ...base,
  testDir: './tests/integration-browser',
  globalTimeout: 240000,
  use: { ...base.use, trace: 'off', screenshot: 'off' },
  webServer: {
    ...base.webServer,
    env: {
      ...base.webServer.env,
      VITE_CLINICAL_PREVIEW_ENABLED: 'false',
      VITE_CLINICAL_INTEGRATION_ENABLED: 'true',
    },
  },
})
