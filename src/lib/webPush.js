export function isValidVapidPublicKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{87}$/.test(value))
    return false
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const binary = globalThis.atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    return binary.length === 65 && binary.charCodeAt(0) === 4
  } catch {
    return false
  }
}

export function decodeVapidPublicKey(value) {
  if (!isValidVapidPublicKey(value))
    throw new Error('A chave pública de notificações não está configurada.')
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = globalThis.atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function isAllowedWebPushEndpoint(value) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    const authority = value.match(/^https:\/\/([^/?#]+)/i)?.[1] ?? ''
    const supportedHost =
      [
        'fcm.googleapis.com',
        'updates.push.services.mozilla.com',
        'web.push.apple.com',
        'notify.windows.com',
      ].includes(host) || host.endsWith('.notify.windows.com')
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      !/:\d+$/.test(authority) &&
      supportedHost
    )
  } catch {
    return false
  }
}
