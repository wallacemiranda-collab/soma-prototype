self.addEventListener('install', (event) => {
  const hostname = self.location.hostname
  const allowedHost =
    ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ||
    /^soma-prototype-nc87-[a-z0-9-]+-wallace-miranda-s-projects\.vercel\.app$/.test(
      hostname,
    )
  if (!allowedHost)
    event.waitUntil(Promise.reject(new Error('Reminder preview origin required')))
})

self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('Endo +', {
      body: 'Hora de cuidar da sua rotina.',
      icon: '/icons/endo-preview-192.png',
      badge: '/icons/endo-preview-192.png',
      tag: 'endo-routine-reminder',
      renotify: false,
      data: { path: '/lembretes' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const target = new URL('/lembretes', self.location.origin).href
      const existing = clients.find((client) => {
        try {
          return new URL(client.url).origin === self.location.origin
        } catch {
          return false
        }
      })
      if (existing)
        return existing.navigate(target).then(() => existing.focus())
      return self.clients.openWindow(target)
    }),
  )
})
