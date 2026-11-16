/**
 * Exercises the host-side fallback's command construction on every platform,
 * from this machine. No process is spawned and nothing touches the network.
 */
import assert from 'node:assert/strict'
import { buildCommand } from '../index.js'

const options = { title: 'DeepSeek Harness', subtitle: '任务完成', sound: 'Glass' }

const darwin = buildCommand('darwin', options, '回答已完成')
assert.equal(darwin.command, '/usr/bin/osascript')
assert.match(darwin.args[1], /^display notification "回答已完成"/)
assert.match(darwin.args[1], /with title "DeepSeek Harness"/)
assert.match(darwin.args[1], /subtitle "任务完成"/)
assert.match(darwin.args[1], /sound name "Glass"$/)

const silent = buildCommand('darwin', { ...options, sound: 'silent' }, 'x')
assert.doesNotMatch(silent.args[1], /sound name/)

const escaped = buildCommand('darwin', options, 'a "quoted" line\nnext')
assert.match(escaped.args[1], /\\"quoted\\"/)
assert.match(escaped.args[1], /line next/)
assert.doesNotMatch(escaped.args[1], /\n/)

const linux = buildCommand('linux', options, 'Turn finished')
assert.equal(linux.command, 'notify-send')
assert.deepEqual(linux.args.slice(0, 2), ['--app-name', 'DeepSeek Harness'])
assert.equal(linux.args.at(-1), 'Turn finished')

assert.equal(buildCommand('win32', options, 'x'), null)

console.log('host harness ok')
