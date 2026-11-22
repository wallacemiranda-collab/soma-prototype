import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { collectSourceFiles } from '../staging/previewPackage.mjs'
import { readBackendConfig } from '../../src/lib/backendConfig.js'

export const productionProject = 'trlwhngxqfgksiponpzk'
export function collectReleaseFiles(root, { url, key, googleEnabled = false }) {
  if (
    url !== `https://${productionProject}.supabase.co` ||
    typeof key !== 'string' ||
    !/^[A-Za-z0-9_.-]+$/.test(key) ||
    !readBackendConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key })
      .configured ||
    typeof googleEnabled !== 'boolean'
  )
    throw new Error(
      'Release guard: production URL and public credentials required.',
    )
  const files = collectSourceFiles(root)
  const entry = files.find((file) => file.file === 'vercel.json')
  const config = JSON.parse(entry.data)
  if (
    config.redirects?.length !== 4 ||
    !config.rewrites?.some((row) => row.destination === '/')
  )
    throw new Error('Release guard: preserve redirects and SPA routing.')
  config.buildCommand = `env VITE_PHASE3_PREVIEW_ENABLED=false VITE_SUPABASE_URL=${url} VITE_SUPABASE_ANON_KEY=${key} VITE_HOMOLOGATION_ENABLED=false VITE_CLINICAL_INTEGRATION_ENABLED=true VITE_CLINICAL_PREVIEW_ENABLED=false VITE_GOOGLE_AUTH_ENABLED=${googleEnabled} node node_modules/vite/bin/vite.js build`
  config.installCommand = 'pnpm install --frozen-lockfile'
  config.outputDirectory = 'dist'
  config.framework = 'vite'
  entry.data = JSON.stringify(config, null, 2)
  if (
    files.some(
      (file) =>
        file.file === 'public/robots.txt' && /Disallow:\s*\//.test(file.data),
    ) ||
    config.headers?.some((row) =>
      row.headers?.some(
        (header) =>
          header.key.toLowerCase() === 'x-robots-tag' &&
          header.value.includes('noindex'),
      ),
    )
  )
    throw new Error('Release guard: no homologation indexing rules.')
  return {
    files,
    digest: createHash('sha256').update(JSON.stringify(files)).digest('hex'),
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = collectReleaseFiles(process.cwd(), {
    url: process.env.ENDO_RELEASE_SUPABASE_URL,
    key: process.env.ENDO_RELEASE_SUPABASE_KEY,
    googleEnabled: process.env.ENDO_RELEASE_GOOGLE_ENABLED === 'true',
  })
  const chunks = []
  for (const file of result.files) {
    if (
      !chunks.length ||
      Buffer.byteLength(JSON.stringify(chunks.at(-1))) > 30000
    )
      chunks.push([])
    chunks.at(-1).push(file)
  }
  if (process.argv[2] === 'manifest')
    console.log(
      JSON.stringify({
        digest: result.digest,
        files: result.files.length,
        chunks: chunks.length,
      }),
    )
  else if (process.argv[2] === 'chunk' && chunks[Number(process.argv[3])])
    process.stdout.write(JSON.stringify(chunks[Number(process.argv[3])]))
  else throw new Error('Choose manifest or a valid chunk.')
}
