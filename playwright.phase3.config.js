import base from './playwright.config.js'

// Playwright 1.56 needs this to apply offline emulation to worker fetches too.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1'

export default {
  ...base,
  testDir: './tests/phase3-browser',
  workers: 1,
  timeout: 60000,
  globalTimeout: 600000,
  expect: { timeout: 15000 },
  use: {
    ...base.use,
    baseURL: process.env.ENDO_PHASE3_URL || 'http://127.0.0.1:4177',
    trace: 'off',
    screenshot: 'off',
  },
  webServer: process.env.ENDO_PHASE3_URL
    ? undefined
    : {
        ...base.webServer,
        command: `"${process.execPath}" node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4177 --strictPort`,
        url: 'http://127.0.0.1:4177',
        env: {
          VITE_PHASE3_PREVIEW_ENABLED: 'true',
          VITE_SUPABASE_URL: '',
          VITE_SUPABASE_ANON_KEY: '',
          VITE_CLINICAL_INTEGRATION_ENABLED: 'false',
          VITE_CLINICAL_PREVIEW_ENABLED: 'false',
          VITE_HOMOLOGATION_ENABLED: 'false',
          VITE_GOOGLE_AUTH_ENABLED: 'false',
        },
      },
}
