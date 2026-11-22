import test from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { loadReviewAccess } from '../staging/reviewAccess.mjs'

test(
  'the published preview refuses to mount authentication when the backend marker is wrong',
  { timeout: 45000 },
  async () => {
    const config = loadReviewAccess()
    const browser = await chromium.launch({
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    })
    try {
      const page = await browser.newPage({
        viewport: { width: 320, height: 740 },
        locale: 'pt-BR',
      })
      let authRequests = 0
      page.on('request', (request) => {
        if (new URL(request.url()).pathname.startsWith('/auth/v1/'))
          authRequests++
      })
      await page.route(
        `${config.url}/rest/v1/rpc/endo_homologation_info`,
        async (route) => {
          const headers = {
            'access-control-allow-origin': config.review.origin,
            'access-control-allow-headers': '*',
            'access-control-allow-methods': 'POST,OPTIONS',
          }
          if (route.request().method() === 'OPTIONS')
            return route.fulfill({ status: 204, headers })
          return route.fulfill({
            status: 200,
            headers,
            json: {
              environment: 'production',
              project_id: 'trlwhngxqfgksiponpzk',
              synthetic_only: false,
            },
          })
        },
      )
      await page.goto(config.review.url)
      await expect(page.getByRole('alert')).toContainText(
        'Não foi possível confirmar o ambiente separado',
        { timeout: 20000 },
      )
      await expect(
        page.getByRole('complementary', { name: 'Ambiente de testes' }),
      ).toBeVisible()
      await expect(page.getByLabel('E-mail', { exact: true })).toHaveCount(0)
      assert.equal(authRequests, 0)
    } finally {
      await browser.close()
    }
  },
)
