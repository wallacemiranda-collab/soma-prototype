import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

const canonical = 'https://endoplus.vercel.app'
const override = process.env.ENDO_PUBLIC_URL

describe('canonical production domain', {
  skip: Boolean(override && new URL(override).origin !== canonical),
  timeout: 60000,
}, () => {
  for (const hostname of ['soma-prototype-nc87.vercel.app', 'endo-plus.vercel.app']) {
    test(`${hostname} redirects its homepage and private paths`, async () => {
      for (const path of ['/', '/?origem=teste', '/perfil', '/login?acesso=medico']) {
        const response = await fetch(`https://${hostname}${path}`, {
          redirect: 'manual',
          signal: AbortSignal.timeout(10000),
        })
        assert.equal(response.status, 308, `${hostname}${path}`)
        const target = new URL(response.headers.get('location'))
        assert.equal(target.href, new URL(canonical + path).href)
        const destination = await fetch(target, {
          redirect: 'manual',
          signal: AbortSignal.timeout(10000),
        })
        assert.equal(destination.status, 200)
        assert.ok((await destination.text()).includes('<title>Endo +'))
      }
    })
  }
})
