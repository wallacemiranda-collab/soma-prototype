import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { collectSourceFiles } from '../staging/previewPackage.mjs'

export function collectPhase3Files(root) {
  const files = collectSourceFiles(root)
  const entry = files.find((file) => file.file === 'vercel.json')
  const config = JSON.parse(entry.data)
  config.buildCommand = 'pnpm build'
  config.installCommand = 'pnpm install --frozen-lockfile'
  config.framework = 'vite'
  config.outputDirectory = 'dist'
  const packageEntry = files.find((file) => file.file === 'package.json')
  const packageConfig = JSON.parse(packageEntry.data)
  packageConfig.scripts.build =
    'VITE_PHASE3_PREVIEW_ENABLED=true VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= VITE_HOMOLOGATION_ENABLED=false VITE_CLINICAL_PREVIEW_ENABLED=false VITE_CLINICAL_INTEGRATION_ENABLED=false VITE_GOOGLE_AUTH_ENABLED=false vite build'
  packageEntry.data = JSON.stringify(packageConfig, null, 2)
  config.headers = [
    ...(config.headers || []),
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
      ],
    },
    {
      source: '/phase3-sw.js',
      headers: [{ key: 'Cache-Control', value: 'no-store' }],
    },
  ]
  entry.data = JSON.stringify(config, null, 2)
  files.push({
    file: 'public/robots.txt',
    encoding: 'utf-8',
    data: 'User-agent: *\nDisallow: /\n',
  })
  return {
    files,
    digest: createHash('sha256').update(JSON.stringify(files)).digest('hex'),
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = collectPhase3Files(process.cwd())
  if (process.argv[2] === 'manifest')
    console.log(
      JSON.stringify({ files: result.files.length, digest: result.digest }),
    )
  else if (process.argv[2] === 'files')
    process.stdout.write(JSON.stringify(result.files))
  else throw new Error('Choose manifest or files.')
}
