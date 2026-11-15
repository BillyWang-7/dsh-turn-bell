#!/usr/bin/env node
/**
 * Publish dsh-turn-bell to the public npm registry without the npm CLI.
 *
 *   NPM_TOKEN=npm_xxx node publish/publish-npm.mjs [--dry-run]
 *
 * The registry PUT needs the tarball, its sha1 shasum and its sha512 integrity,
 * plus the full manifest; this script derives all of that from dist/ and
 * package.json so a release is one command. It never prints the token.
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
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

const manifest = {
  ...pkg,
  _id: `${pkg.name}@${version}`,
  dist: { shasum, integrity, tarball },
}

const body = {
  _id: pkg.name,
  name: pkg.name,
  description: pkg.description,
  'dist-tags': { latest: version },
  versions: { [version]: manifest },
  readme: readFileSync(join(root, 'README.md'), 'utf8'),
  _attachments: {
    [fileName]: {
      content_type: 'application/octet-stream',
      data: tgz.toString('base64'),
      length: tgz.length,
    },
  },
}

console.log(`${pkg.name}@${version}  tarball ${tgz.length} B  sha1 ${shasum}`)

if (dryRun) {
  console.log('dry run: would PUT', `https://registry.npmjs.org/${encodeURIComponent(pkg.name)}`, `(${JSON.stringify(body).length} B body)`)
  process.exit(0)
}
if (token === undefined || token === '') {
  console.error('NPM_TOKEN is missing; create an Automation token at https://www.npmjs.com/settings/<user>/tokens')
  process.exit(1)
}

const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}`, {
  method: 'PUT',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

const text = await response.text()
if (!response.ok) {
  console.error(`publish failed: HTTP ${String(response.status)}\n${text.slice(0, 2000)}`)
  process.exit(1)
}
console.log(`published ${pkg.name}@${version}: HTTP ${String(response.status)}`)
console.log(`install with: dsh plugin add ${pkg.name}`)
