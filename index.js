/**
 * Host-side fallback for Turn Bell: posts a system notification when an agent
 * turn finishes, for setups that have no renderer attached (a plain CLI), so a
 * long-running answer does not have to be watched to know it is done.
 *
 * The renderer half (`client.js`) is the primary channel and the only one that
 * works on all three desktop platforms; this file exists for the rest:
 *
 *   macOS    `/usr/bin/osascript -e 'display notification …'`
 *            (banners are attributed to “Script Editor”, which is why the
 *            channel is off by default)
 *   Linux    `notify-send` from libnotify, when it is installed
 *   Windows  nothing — the desktop app always has a renderer, and Windows has
 *            no notifier that is guaranteed to exist on every machine, so this
 *            channel logs once and stays silent rather than inventing one.
 *
 * Every value is escaped before it reaches a shell-free argument list, and a
 * delivery failure only logs; it never affects the turn.
 */
import { execFile } from 'node:child_process'

const DEFAULTS = {
  enabled: false,
  title: 'DeepSeek Harness',
  subtitle: '任务完成',
  sound: 'Glass',
  notifySubagents: false,
  notifyOnBlocked: false,
}

/** Turn-end kinds worth waking the user for. `aborted`, `interrupted` and `forked` are not. */
const NOTIFY_KINDS = new Set(['completed', 'error', 'max-tokens', 'blocked'])

/** Encode one value as an AppleScript string literal on a single line. */
function literal(value) {
  const text = String(value).replace(/\s*[\r\n]+\s*/g, ' ').trim()
  return `"${text.replace(/[\\"]/g, character => `\\${character}`)}"`
}

/**
 * The command that delivers one banner on `platform`, or `null` when the
 * platform has no dependable command-line notifier. Pure, so it is unit-tested
 * for every platform on every platform.
 */
export function buildCommand(platform, options, body) {
  if (platform === 'darwin') {
    const parts = [`display notification ${literal(body)}`]
    if (options.title) parts.push(`with title ${literal(options.title)}`)
    if (options.subtitle) parts.push(`subtitle ${literal(options.subtitle)}`)
    if (options.sound && options.sound !== 'silent') parts.push(`sound name ${literal(options.sound)}`)
    return { command: '/usr/bin/osascript', args: ['-e', parts.join(' ')] }
  }
  if (platform === 'linux') {
    // notify-send SUMMARY [BODY]; the app name keeps the banner grouped under
    // DeepSeek Harness in notification daemons that honour it.
    const summary = String(options.title || 'DeepSeek Harness')
    const args = ['--app-name', summary]
    if (options.sound === 'silent') args.push('--hint', 'string:sound-name:')
    args.push(summary, String(body))
    return { command: 'notify-send', args }
  }
  return null
}

/** Normalize a TurnEndReason (object or bare kind) to its kind. */
function kindOf(reason) {
  if (typeof reason === 'string') return reason
  if (reason !== null && typeof reason === 'object' && typeof reason.kind === 'string') return reason.kind
  return 'completed'
}

export function apply(ctx, config) {
  const options = { ...DEFAULTS, ...(config ?? {}) }
  if (options.enabled === false) return

  const logger = ctx.logger('turn-bell')
  let warned = false

  const post = (session) => {
    let sessionTitle = ''
    try {
      sessionTitle = ctx.sessionTitle?.get(session)?.title ?? ''
    } catch {
      // The title service is optional here; the generic body still works.
    }
    const body = sessionTitle.length > 0 ? sessionTitle : '回答已完成'
    const invocation = buildCommand(process.platform, options, body)
    if (invocation === null) {
      if (!warned) {
        warned = true
        logger.warn('no host-side notifier for this platform; use the renderer channel')
      }
      return
    }
    execFile(invocation.command, invocation.args, { timeout: 5000 }, (error) => {
      if (error) logger.warn(error)
    })
  }

  ctx.on('session/event', (session, event) => {
    if (event?.type !== 'turn/end') return
    const kind = kindOf(event.data?.reason)
    if (!NOTIFY_KINDS.has(kind)) return
    if (kind === 'blocked' && options.notifyOnBlocked !== true) return
    if (options.notifySubagents !== true) {
      try {
        if (session?.header?.origin === 'subagent') return
      } catch {
        // An unreadable header is not a reason to drop a real notification.
      }
    }
    post(session)
  })
}
