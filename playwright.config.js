import { defineConfig } from '@playwright/test'

export const testBackend = 'https://endo-tests.invalid'
process.env.TZ = 'America/Sao_Paulo'

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  timeout: 30000,
  globalTimeout: 120000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    viewport: { width: 390, height: 844 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    },
  },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174 --strictPort`,
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    env: {
      VITE_SUPABASE_URL: testBackend,
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_synthetic_browser_tests',
      VITE_GOOGLE_AUTH_ENABLED: 'false',
      VITE_PHASE3_PREVIEW_ENABLED: 'false',
    },
  },
})
