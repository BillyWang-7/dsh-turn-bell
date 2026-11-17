#!/usr/bin/env node
/**
 * Publish dsh-turn-bell to the public npm registry without the npm CLI.
 *
 *   NPM_TOKEN=npm_xxx node publish/publish-npm.mjs [--dry-run]
 *
 * The registry PUT needs the tarball, its sha1 shasum and its sha512 integrity,
 * plus the full manifest; this script derives all of that from dist/ and
 * package.json so a release is one command.
 *
 * The request goes through `curl`, not `fetch`: this machine's Node cannot
 * reach registry.npmjs.org (undici connect timeout against Cloudflare) while
 * curl can, and curl keeps the token out of argv via a private -K config file.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, chmodSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version
const fileName = `${pkg.name}-${version}.tgz`
const tgz = readFileSync(join(root, 'dist', fileName))
const token = process.env.NPM_TOKEN
const dryRun = process.argv.includes('--dry-run')

const shasum = createHash('sha1').update(tgz).digest('hex')
const integrity = `sha512-${createHash('sha512').update(tgz).digest('base64')}`
const tarball = `https://registry.npmjs.org/${pkg.name}/-/${fileName}`

const body = {
  _id: pkg.name,
  name: pkg.name,
  description: pkg.description,
  'dist-tags': { latest: version },
  versions: {
    [version]: {
      ...pkg,
      _id: `${pkg.name}@${version}`,
      readme: readFileSync(join(root, 'README.md'), 'utf8'),
      readmeFilename: 'README.md',
      dist: { shasum, integrity, tarball },
    },
  },
  readme: readFileSync(join(root, 'README.md'), 'utf8'),
  _attachments: {
    [fileName]: {
      content_type: 'application/octet-stream',
      data: tgz.toString('base64'),
      length: tgz.length,
    },
  },
}

const url = `https://registry.npmjs.org/${encodeURIComponent(pkg.name)}`
console.log(`${pkg.name}@${version}  tarball ${tgz.length} B  sha1 ${shasum}`)

if (dryRun) {
  console.log(`dry run: would PUT ${url} (${JSON.stringify(body).length} B body)`)
  process.exit(0)
}
if (token === undefined || token === '') {
  console.error('NPM_TOKEN is missing; create an Automation token with 2FA bypass at https://www.npmjs.com/settings/<user>/tokens')
  process.exit(1)
}

const dir = mkdtempSync(join(tmpdir(), 'dsh-publish-'))
try {
  const payloadPath = join(dir, 'payload.json')
  const configPath = join(dir, 'curl.conf')
  writeFileSync(payloadPath, JSON.stringify(body))
  writeFileSync(configPath, `header = "authorization: Bearer ${token}"\nheader = "content-type: application/json"\n`)
  chmodSync(configPath, 0o600)

  const result = spawnSync('curl', [
    '-sS', '--max-time', '180', '-X', 'PUT', url,
    '-K', configPath,
    '--data-binary', `@${payloadPath}`,
    '-w', '\n%{http_code}',
  ], { encoding: 'utf8' })

  if (result.error !== undefined) {
    console.error(`curl failed: ${result.error.message}`)
    process.exit(1)
  }
  const output = (result.stdout ?? '').trim()
  const cut = output.lastIndexOf('\n')
  const status = Number(output.slice(cut + 1))
  const text = output.slice(0, cut)
  if (!Number.isFinite(status) || status < 200 || status > 299) {
    console.error(`publish failed: HTTP ${String(status)}\n${text.slice(0, 2000)}`)
    process.exit(1)
  }
  if (text.trim() !== '') console.log(text.trim())
  console.log(`published ${pkg.name}@${version}: HTTP ${String(status)}`)
  console.log(`install with: dsh plugin add ${pkg.name}`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
