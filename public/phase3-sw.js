const allowedHost =
  ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname) ||
  /^soma-prototype-nc87-(?:[a-z0-9]+|git-codex-fase3-previa)-wallace-miranda-s-projects\.vercel\.app$/.test(
    self.location.hostname,
  )

self.addEventListener('install', (event) => {
  if (!allowedHost)
    event.waitUntil(Promise.reject(new Error('Preview origin required')))
})

// Network only: no patient pages, credentials or API responses are cached.
self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (
    !allowedHost ||
    request.method !== 'GET' ||
    request.mode !== 'navigate' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  )
    return
  event.respondWith(
    fetch(request, { cache: 'no-store' }).catch(
      () =>
        new Response(
          '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Endo + Prévia sem conexão</title><body style="margin:0;padding:32px;font:18px system-ui;background:#F8FAFC;color:#0b2d57"><main style="max-width:430px;margin:auto"><h1>Você está sem conexão</h1><p>Reconecte-se à internet e abra novamente a prévia do Endo +.</p><p>Nenhum registro de saúde foi salvo para uso offline.</p></main></body></html>',
          {
            status: 503,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          },
        ),
    ),
  )
})
