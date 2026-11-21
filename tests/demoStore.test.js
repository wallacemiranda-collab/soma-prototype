import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createDemoData,
  createDemoStore,
  demoSession,
  demoStorageKey,
} from '../src/lib/demoStore.js'

function storage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

test('demo must be started explicitly and survives a new store in the same tab', () => {
  const cache = storage()
  const first = createDemoStore(cache)
  assert.equal(first.read(), null)
  const data = first.start()
  data.habitLogs.push({
    logged_at: data.entries[0].entry_date,
    habit_key: 'movement',
    value: 1,
  })
  first.save(data)
  assert.deepEqual(createDemoStore(cache).read(), first.read())
  first.clear()
  assert.equal(createDemoStore(cache).read(), null)
})

test('demo cache never restores account identity, personal details or credentials', () => {
  const cache = storage()
  const data = createDemoData()
  data.profile = {
    full_name: 'Real patient',
    birth_date: '1990-01-01',
    sex: 'female',
    id: 'real-id',
    email: 'patient@example.invalid',
  }
  data.access_token = 'should-not-persist'
  data.entries[0].user_id = 'another-patient'
  const store = createDemoStore(cache)
  store.save(data)
  const raw = cache.getItem(demoStorageKey)
  for (const field of [
    'Real patient',
    '1990-01-01',
    'real-id',
    'patient@example.invalid',
    'should-not-persist',
    'another-patient',
  ])
    assert.equal(raw.includes(field), false)
  assert.equal(demoSession().user.id, 'demo-user')
  assert.equal(demoSession().access_token, undefined)
  assert.equal(createDemoStore(storage()).read(), null)
})

test('malformed, unsupported, invalid and duplicate cached data cannot restore demo', () => {
  for (const raw of [
    '{',
    JSON.stringify({ version: 99, mode: 'demo', data: createDemoData() }),
    JSON.stringify({ version: 1, mode: 'real', data: createDemoData() }),
    JSON.stringify({
      version: 1,
      mode: 'demo',
      data: {
        ...createDemoData(),
        entries: [{ entry_date: 'invalid', weight_kg: 80 }],
      },
    }),
    JSON.stringify({
      version: 1,
      mode: 'demo',
      data: {
        ...createDemoData(),
        entries: [...createDemoData().entries, createDemoData().entries[0]],
      },
    }),
  ]) {
    const cache = storage()
    cache.setItem(demoStorageKey, raw)
    assert.equal(createDemoStore(cache).read(), null)
    assert.equal(cache.getItem(demoStorageKey), null)
  }
})

test('blocked or full session storage keeps demo in memory and never breaks logout', () => {
  const blocked = {
    getItem() {
      throw Error('blocked')
    },
    setItem() {
      throw Error('blocked')
    },
    removeItem() {
      throw Error('blocked')
    },
  }
  const store = createDemoStore(blocked)
  store.start()
  assert.ok(store.read())
  store.clear()
  assert.equal(store.read(), null)
  const full = {
    ...storage(),
    setItem() {
      throw Error('quota')
    },
  }
  const second = createDemoStore(full)
  second.start()
  assert.ok(second.read())
})
