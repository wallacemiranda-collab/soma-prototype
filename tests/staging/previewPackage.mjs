import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stagingProject } from './support.mjs'
import { isValidVapidPublicKey } from '../../src/lib/webPush.js'

export function collectSourceFiles(root) {
  const paths = [
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'index.html',
    'vite.config.js',
    'tailwind.config.js',
    'postcss.config.js',
    'vercel.json',
    'scripts/build.js',
  ]
  function visit(path) {
    const info = lstatSync(resolve(root, path))
    if (info.isSymbolicLink())
      throw new Error('Preview sources cannot be symlinks.')
    if (info.isDirectory())
      for (const name of readdirSync(resolve(root, path)).sort())
        visit(`${path}/${name}`)
    else if (
      info.isFile() &&
      !path.split('/').some((part) => part.startsWith('.')) &&
      (/\.(js|jsx|css|svg)$/.test(path) ||
        ['public/manifest.webmanifest', 'public/reminders-manifest.webmanifest'].includes(path) ||
        /^public\/icons\/endo-preview-(180|192|512)\.png$/.test(path))
    )
      paths.push(path)
    else throw new Error(`Unexpected preview source: ${path}`)
  }
  visit('src')
  visit('public')
  return paths.sort().map((file) => {
    if (
      !lstatSync(resolve(root, file)).isFile() ||
      lstatSync(resolve(root, file)).isSymbolicLink()
    )
      throw new Error('Invalid source file.')
    const encoding = file.endsWith('.png') ? 'base64' : 'utf-8'
    return {
      file,
      data: readFileSync(resolve(root, file)).toString(
        encoding === 'base64' ? 'base64' : 'utf8',
      ),
      encoding,
    }
  })
}

export function collectPreviewFiles(root, key, reminderPublicKey) {
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))
    throw new Error('Only a public staging key is allowed.')
  if (!isValidVapidPublicKey(reminderPublicKey))
    throw new Error('A public reminder push key is required.')
  const files = collectSourceFiles(root)
  const settings = files.find((file) => file.file === 'vercel.json')
  const config = JSON.parse(settings.data)
  config.buildCommand = `env VITE_PHASE3_PREVIEW_ENABLED=false VITE_SUPABASE_URL=https://${stagingProject}.supabase.co VITE_SUPABASE_ANON_KEY=${key} VITE_REMINDER_VAPID_PUBLIC_KEY=${reminderPublicKey} VITE_HOMOLOGATION_ENABLED=true VITE_REMINDERS_HOMOLOGATION_ENABLED=true VITE_CLINICAL_INTEGRATION_ENABLED=true VITE_CLINICAL_PREVIEW_ENABLED=false VITE_GOOGLE_AUTH_ENABLED=false node node_modules/vite/bin/vite.js build`
  config.installCommand = 'pnpm install --frozen-lockfile'
  config.outputDirectory = 'dist'
  config.framework = 'vite'
  config.headers = [
    ...(config.headers || []),
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ]
  settings.data = JSON.stringify(config, null, 2)
  files.push({
    file: 'public/robots.txt',
    data: 'User-agent: *\nDisallow: /\n',
    encoding: 'utf-8',
  })
  const digest = createHash('sha256')
    .update(JSON.stringify(files))
    .digest('hex')
  return { files, digest }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = collectPreviewFiles(
    process.cwd(),
    process.env.ENDO_STAGING_PUBLISHABLE_KEY,
    process.env.ENDO_STAGING_REMINDER_VAPID_PUBLIC_KEY,
  )
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
        bytes: Buffer.byteLength(JSON.stringify(result.files)),
      }),
    )
  else if (process.argv[2] === 'chunk' && chunks[Number(process.argv[3])])
    process.stdout.write(JSON.stringify(chunks[Number(process.argv[3])]))
  else throw new Error('Choose manifest or a valid chunk.')
}
