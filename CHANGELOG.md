# Changelog

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
