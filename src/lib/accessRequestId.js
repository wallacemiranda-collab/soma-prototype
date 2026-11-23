export function createAccessRequestId(cryptoSource = globalThis.crypto) {
  if (typeof cryptoSource?.randomUUID === 'function')
    return cryptoSource.randomUUID()

  if (typeof cryptoSource?.getRandomValues !== 'function')
    throw new Error('Não foi possível iniciar um registro seguro de acesso.')

  const bytes = cryptoSource.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'))
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}

export const accessScopeLabels = {
  clinical: 'dados clínicos',
  habits: 'hábitos',
  measurements: 'medidas e evolução',
  profile: 'perfil',
}
