export function isAllowedWebPushEndpoint(value) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    const authority = value.match(/^https:\/\/([^/?#]+)/i)?.[1] ?? ''
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      !/:\d+$/.test(authority) &&
      (host === 'fcm.googleapis.com' ||
        host === 'updates.push.services.mozilla.com' ||
        host === 'web.push.apple.com' ||
        host === 'notify.windows.com' ||
        host.endsWith('.notify.windows.com'))
    )
  } catch {
    return false
  }
}

export function genericReminderPayload() {
  return JSON.stringify({ path: '/lembretes' })
}
