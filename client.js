/**
 * Browser half of Turn Bell (收工铃).
 *
 * The Web page runs inside the desktop shell's Chromium renderer, so the HTML5
 * `Notification` API posts banners under DeepSeek Harness's own identity
 * (`com.deepseek.dsh`): the app icon, the app's sound and the app's notification
 * settings in System Settings → Notifications.
 *
 * Source of truth: the client-side session status map published by
 * `@deepseek-ai/dsh-client-ui-session` as `uiSession.sessionStatus`:
 *
 *   Map<sessionId, { running, pendingInteraction, completionUnread }>
 *
 * Client modules do NOT receive the host's `session/event` bus, so this module
 * only reads that published store:
 *
 * - `running` true → false           ⇒ a turn ended ⇒ completion banner
 * - `pendingInteraction` empty → set  ⇒ the agent needs you (approval / question)
 *
 * The `uiSession` service is looked up lazily and retried: this client entry can
 * apply before the shell's ui-session entry activates. Titles come from
 * `ctx.sessions.list` rows (`title`, `origin`). Subagent rows stay silent, and a
 * banner is skipped only when it would announce the session already on screen.
 */
window.__ModuleLoader__.load({
  id: 'dsh-turn-bell',
  factory() {
    const DEFAULT_TITLE = 'DeepSeek Harness'
    const RETRY_MS = 1500
    const MAX_RETRIES = 40

    function isStore(candidate) {
      return candidate !== undefined && candidate !== null && typeof candidate.getSnapshot === 'function' && typeof candidate.subscribe === 'function'
    }

    function lookup(ctx, name) {
      try {
        if (typeof ctx.get === 'function') {
          const service = ctx.get(name)
          if (service) return service
        }
      } catch {}
      try {
        if (ctx.reflect !== undefined && typeof ctx.reflect.get === 'function') {
          const service = ctx.reflect.get(name)
          if (service) return service
        }
      } catch {}
      try {
        return ctx[name]
      } catch {
        return undefined
      }
    }

    function asMap(snapshot) {
      if (snapshot instanceof Map) return snapshot
      const map = new Map()
      if (snapshot !== null && typeof snapshot === 'object') {
        for (const key of Object.keys(snapshot)) map.set(key, snapshot[key])
      }
      return map
    }

    const COPY = {
      zh: { done: '回答已完成', attention: '需要你确认或回答' },
      en: { done: 'Turn finished', attention: 'Needs your confirmation' },
    }

    /** Follow the DSH UI language, falling back to the browser's. */
    function copy(ctx) {
      let language = ''
      try {
        const service = lookup(ctx, 'locale')
        if (service !== null && service !== undefined && typeof service.getLocale === 'function') {
          const active = service.getLocale()?.active
          if (typeof active === 'string') language = active
        }
      } catch {}
      if (language === '') {
        try {
          language = String(navigator.language ?? '')
        } catch {}
      }
      return String(language).toLowerCase().startsWith('zh') ? COPY.zh : COPY.en
    }

    function canNotify() {
      return typeof Notification === 'function'
    }

    /**
     * Bring the conversation behind a banner to the front: `uiWorkspace.openSession`
     * replaces the main view with that session, so clicking a banner lands on the
     * conversation that finished or that is waiting for an approval, not merely on
     * the app window.
     */
    function openSession(ctx, sessionId) {
      try {
        const workspace = lookup(ctx, 'uiWorkspace')
        if (workspace !== null && workspace !== undefined && typeof workspace.openSession === 'function') {
          workspace.openSession(sessionId)
          return true
        }
      } catch (error) {
        console.warn('[turn-bell] could not open the session from the banner', error)
      }
      return false
    }

    function show(ctx, sessionId, title, body, tag) {
      if (!canNotify()) return
      const fire = () => {
        try {
          const notification = new Notification(title, { body, tag, silent: false })
          notification.onclick = () => {
            try {
              openSession(ctx, sessionId)
            } catch {}
            try {
              window.focus()
            } catch {}
            notification.close()
          }
        } catch (error) {
          console.warn('[turn-bell] could not post notification', error)
        }
      }
      if (Notification.permission === 'granted') {
        fire()
        return
      }
      if (Notification.permission === 'default') {
        Notification.requestPermission()
          .then((permission) => {
            if (permission === 'granted') fire()
          })
          .catch(() => {})
      }
    }

    function visibleAndFocused() {
      try {
        return document.visibilityState === 'visible' && document.hasFocus()
      } catch {
        return false
      }
    }

    return {
      inject: ['sessions'],
      apply(ctx) {
        const arm = () => {
          // `ctx.sessions` is guaranteed by the module-level inject; the
          // lookup keeps a plain property read working as a fallback.
          const service = lookup(ctx, 'sessions')
          const list = service !== undefined && service !== null ? service.list : undefined
          if (!isStore(list)) {
            console.warn('[turn-bell] sessions.list is unavailable; not armed')
            return
          }

          /** uiSession.sessionStatus, once the shell service is visible. */
          let store = null
          let off = null
          /** sessionId → { running, pending } from the last published snapshot. */
          let previous = new Map()
          let primed = false

          const currentId = () => {
            try {
              const snapshot = list.getSnapshot()
              if (typeof snapshot.current === 'string' && snapshot.current !== '') return snapshot.current
              const rows = snapshot.byId !== undefined ? snapshot.byId : {}
              for (const id of Object.keys(rows)) {
                const row = rows[id]
                if (row !== undefined && row !== null && row.retainedBy !== undefined && (row.retainedBy.mainView ?? 0) > 0) return id
              }
            } catch {}
            return null
          }

          const rowOf = (id) => {
            try {
              const rows = list.getSnapshot().byId
              return rows !== undefined ? rows[id] : undefined
            } catch {
              return undefined
            }
          }

          const titleOf = (row) => {
            if (row !== undefined && row !== null) {
              for (const key of ['title', 'displayTitle']) {
                const value = row[key]
                if (typeof value === 'string' && value !== '') return value
              }
            }
            return DEFAULT_TITLE
          }

          const shouldAlert = (id) => !(visibleAndFocused() && currentId() === id)

          const reconcile = () => {
            if (store === null) return
            let snapshot = null
            try {
              snapshot = store.getSnapshot()
            } catch {
              return
            }
            const next = new Map()
            for (const [id, value] of asMap(snapshot)) {
              next.set(id, {
                running: value !== undefined && value !== null && value.running === true,
                pending: value !== undefined && value !== null && value.pendingInteraction !== undefined && value.pendingInteraction !== null,
              })
            }

            if (!primed) {
              // The first snapshot is only a baseline: sessions that were already
              // idle or already waiting when the page loaded must not notify.
              primed = true
              previous = next
              return
            }

            for (const [id, state] of next) {
              const row = rowOf(id)
              if (row !== undefined && row !== null && row.origin === 'subagent') continue
              const before = previous.get(id) ?? { running: false, pending: false }
              if (!shouldAlert(id)) continue
              const text = copy(ctx)
              if (before.running && !state.running) show(ctx, id, titleOf(row), text.done, `dsh-done-${id}`)
              else if (!before.pending && state.pending) show(ctx, id, titleOf(row), text.attention, `dsh-attention-${id}`)
            }

            previous = next
          }

          const bind = () => {
            const ui = lookup(ctx, 'uiSession')
            const candidate = ui !== undefined && ui !== null && isStore(ui.sessionStatus) ? ui.sessionStatus : null
            if (candidate === null) return false
            if (off !== null && candidate === store) return true
            if (off !== null) off()
            store = candidate
            off = store.subscribe(reconcile)
            reconcile()
            return true
          }

          if (!bind()) {
            let tries = 0
            const timer = setInterval(() => {
              tries += 1
              if (bind()) {
                clearInterval(timer)
                return
              }
              if (tries >= MAX_RETRIES) {
                clearInterval(timer)
                console.warn('[turn-bell] uiSession.sessionStatus never became visible; notifications are off')
              }
            }, RETRY_MS)
            ctx.effect(() => () => clearInterval(timer), 'turn-bell: retry uiSession')
          }

          ctx.effect(
            () => () => {
              if (off !== null) off()
              off = null
              store = null
            },
            'turn-bell: session status subscription',
          )

          console.info('[turn-bell] armed: watching session status and pending interactions')
        }

        // The module-level `inject` guarantees ctx.sessions is ready here.
        arm()
      },
    }
  },
})
