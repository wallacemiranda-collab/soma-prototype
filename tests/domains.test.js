import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const config = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
)
const matches = (rule, host) => rule.has.some((condition) =>
  condition.type === 'host' && new RegExp(`^(?:${condition.value})$`).test(host),
)

test('old production hostnames redirect permanently to the Endo + canonical domain', () => {
  for (const host of ['soma-prototype-nc87.vercel.app', 'endo-plus.vercel.app']) {
    const rule = config.redirects.find((candidate) => candidate.source === '/:path*' && matches(candidate, host))
    assert.ok(rule)
    assert.equal(rule.permanent, true)
    assert.equal(rule.source, '/:path*')
    assert.equal(rule.destination, 'https://endoplus.vercel.app/:path*')
  }
})

test('the home page has an explicit redirect on each old hostname', () => {
  for (const host of ['soma-prototype-nc87.vercel.app', 'endo-plus.vercel.app']) {
    const rule = config.redirects.find((candidate) => candidate.source === '/' && matches(candidate, host))
    assert.ok(rule)
    assert.equal(rule.permanent, true)
    assert.equal(rule.destination, 'https://endoplus.vercel.app/')
  }
})

test('canonical domain, previews and localhost never match the old-domain redirects', () => {
  for (const host of [
    'endoplus.vercel.app',
    'soma-prototype-nc87-preview-team.vercel.app',
    'soma-prototype-nc87xvercelyapp',
    'localhost',
  ]) assert.equal(config.redirects.some((rule) => matches(rule, host)), false, host)
})

test('SPA rewrites remain available after hostname redirects', () => {
  assert.deepEqual(config.rewrites, [{ source: '/(.*)', destination: '/' }])
})
