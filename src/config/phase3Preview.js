import { readPhase3Preview } from '../lib/phase3Preview.js'

export const phase3Preview = readPhase3Preview(
  import.meta.env ?? {},
  typeof window === 'undefined' ? '' : window.location.hostname,
)
