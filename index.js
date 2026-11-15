/**
 * Posts a macOS notification when an agent turn finishes, so a long-running
 * answer does not have to be watched to know it is done.
 *
 * Host-only: the desktop shell runs this plugin inside the dsh runtime child
 * process, which cannot reach the Electron Notification API, so the banner is
 * delivered through `osascript`. Every value is escaped before it reaches the
 * AppleScript source; a failure only logs and never affects the turn.
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

  const post = (session) => {
    let sessionTitle = ''
    try {
      sessionTitle = ctx.sessionTitle?.get(session)?.title ?? ''
    } catch {
      // The title service is optional here; the generic body still works.
    }
    const body = sessionTitle.length > 0 ? sessionTitle : '回答已完成'
    const parts = [`display notification ${literal(body)}`]
    if (options.title) parts.push(`with title ${literal(options.title)}`)
    if (options.subtitle) parts.push(`subtitle ${literal(options.subtitle)}`)
    if (options.sound) parts.push(`sound name ${literal(options.sound)}`)
    execFile('/usr/bin/osascript', ['-e', parts.join(' ')], { timeout: 5000 }, (error) => {
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
