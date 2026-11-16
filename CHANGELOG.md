# Changelog

## 2.0.0

- **Windows and Linux support.** The banner channel is the Electron renderer,
  which exists on all three desktop platforms: macOS, Windows, Linux. Same app
  identity, same icon, same click-to-open-conversation behaviour.
- The host fallback now dispatches per platform: `osascript` on macOS,
  `notify-send` on Linux, and a logged no-op on Windows. Its argument building
  is a pure `buildCommand()` and is unit-tested for every platform
  (`node test/host-harness.mjs`).
- Docs cover per-platform permission pages, sound behaviour (macOS can name a
  fallback sound; the renderer and Windows follow the system default) and the
  reload shortcut (Cmd+R / Ctrl+R).

## 1.3.0

- Renamed to **收工铃 / Turn Bell** (`dsh-turn-bell`) for publication.
- Clicking a banner now opens the conversation it is about
  (`uiWorkspace.openSession`), then focuses the window.
- Notification copy follows the DSH UI language instead of always using Chinese.
- Storefront tile (`assets/icon-180.png`), MIT license, bilingual README.

## 1.2.2

- Client reads `uiSession.sessionStatus` instead of `ctx.on('session/event')`,
  which client modules never receive — the first version silently never fired.
- Adds the pending-interaction banner (approval cards and questions).
- Stays quiet for the conversation already foreground in a focused window,
  and for subagent sessions.

## 1.0.0

- Initial host-side, `osascript`-based notifier for finished turns.
