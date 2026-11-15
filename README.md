# 收工铃 · Turn Bell

> A DSH plugin that rings a native DeepSeek Harness notification — the app's own icon and sound — when a turn finishes, or when the agent is waiting for you to approve something or answer a question. Clicking the banner opens the conversation it is about.

## 中文

### 它能做什么

- **一轮回答收工**时弹一条横幅，正文是「回答已完成」，标题是那条会话的标题。
- **智能体需要你**时弹一条横幅，正文是「需要你确认或回答」——不管是审批卡片，还是它在等你回一句话。
- **点通知直接到那条对话**：不是只把 DSH 窗口提到前台，而是切到刚刚完成、或正在等你的那条会话。
- 通知走的是 DeepSeek Harness 自己的身份（`com.deepseek.dsh`），所以横幅上是 DSH 的应用图标和提示音，系统设置里也是按 DSH 这个应用来管。
- 文案跟随 DSH 的界面语言：中文界面弹中文，英文界面弹英文。

### 什么时候不响

- **子代理会话**：后台子代理的每一轮不会逐个弹，避免一次任务弹一串。
- **你正盯着的会话**：当前会话就在前台、窗口也有焦点时不弹；切到别的 app 或别的会话之后照常弹。
- **页面刚打开时就已经空闲/已经在等你的会话**：第一次读到的状态只当下限基准，不会补弹一堆历史通知。

### 安装

```sh
dsh plugin add dsh-turn-bell
```

或者从本地目录安装（开发时）：

```sh
dsh plugin add /path/to/dsh-turn-bell
```

装好后刷新一次 Web 页面（Cmd+R）或重开窗口，让新的客户端模块加载。

### 通知权限与声音

系统设置 → 通知 → DeepSeek Harness。第一次弹之前系统可能先问你一次是否允许；关掉过的话在这里重新打开。横幅样式、提示音、专注模式屏蔽都在这一页。

### 配置（宿主兜底，一般不用开）

插件带一个宿主端的 `osascript` 兜底通道，默认关闭。只有在渲染进程不可用（比如纯 CLI 场景需要通知）时才需要打开；那条通道的横幅会被系统归到「脚本编辑器」，所以不建议和渲染进程通道同时开。

| 键 | 默认 | 含义 |
| --- | --- | --- |
| `enabled` | `false` | 打开宿主端兜底横幅 |
| `title` | `DeepSeek Harness` | 兜底横幅标题 |
| `subtitle` | `任务完成` | 兜底横幅副标题，留空则不显示 |
| `sound` | `Glass` | 兜底提示音；`silent` 表示不响 |
| `notifySubagents` | `false` | 子代理会话也通知（仅兜底通道） |
| `notifyOnBlocked` | `false` | `blocked` 的轮次也通知（仅兜底通道） |

这些值写在插件的 `cordis.patch.yml` 里，也可以在插件列表里改。

### 已知限制

- 只在 DSH Web / 桌面渲染进程里生效，纯 CLI 收不到（那条路走上面的兜底通道）。
- 依赖客户端发布的 `uiSession.sessionStatus` 和 `uiWorkspace.openSession`，在 DSH 0.2.x 上验证（0.2.2-rc.3）。
- macOS 上点通知的激活行为由系统决定：焦点在别的 app 时，点横幅会先激活 DSH，再切到目标会话。
- Windows / Linux 未测试。

### 开发

```sh
node --check client.js
node --check index.js
node test/client-harness.mjs   # 桩环境跑通知逻辑，不联网
```

`client.js` 不监听宿主事件总线，只读客户端发布的会话状态表——客户端模块收不到宿主的 `session/event`，这是这套实现的核心约束。

## English

### What it does

- **A turn finishes** → a banner titled with the conversation title, body “Turn finished”.
- **The agent needs you** → a banner body “Needs your confirmation”, for approval cards and for questions alike.
- **Clicking the banner opens that conversation**: it switches the main view to the session that just finished or that is waiting on you, not merely bringing the DSH window forward.
- Banners are posted by the DeepSeek Harness renderer, so they carry the app's own icon and sound and are governed by the app's notification settings (`com.deepseek.dsh`).
- Copy follows the DSH UI language (Chinese or English).

### When it stays quiet

- **Subagent sessions** — a background subagent never produces one banner per step.
- **The conversation already on screen** — no banner while that session is foreground in a focused window; switch apps or conversations and it rings again.
- **Sessions that were already idle or already waiting when the page loaded** — the first snapshot is only a baseline, so no backlog of stale banners.

### Install

```sh
dsh plugin add dsh-turn-bell
```

From a local checkout during development:

```sh
dsh plugin add /path/to/dsh-turn-bell
```

Reload the Web page (Cmd+R) or reopen the window afterwards so the client module is picked up.

### Permission and sound

System Settings → Notifications → DeepSeek Harness. macOS may ask once before the first banner; if it was turned off, re-enable it there. Banner style, sound and Focus filtering live on that page.

### Configuration (host fallback, off by default)

A host-side `osascript` fallback ships disabled. Enable it only where the renderer is unavailable; banners from that path are attributed to “Script Editor”, so do not run both channels at once.

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `false` | Turn the host-side banner on |
| `title` | `DeepSeek Harness` | Fallback banner title |
| `subtitle` | `任务完成` | Fallback subtitle; empty omits it |
| `sound` | `Glass` | Fallback sound name; `silent` for none |
| `notifySubagents` | `false` | Also notify for subagent turns (fallback only) |
| `notifyOnBlocked` | `false` | Also notify for `blocked` turns (fallback only) |

Set these in the plugin's `cordis.patch.yml`, or edit the row in the plugin list.

### Limitations

- Works in the DSH Web / desktop renderer; a plain CLI session gets nothing unless the fallback channel is enabled.
- Relies on the client-side `uiSession.sessionStatus` and `uiWorkspace.openSession` APIs; verified on DSH 0.2.x (0.2.2-rc.3).
- Notification click behaviour is macOS's: with focus in another app, the banner activates DSH first and then navigates.
- Windows and Linux are untested.

### Development

```sh
node --check client.js
node --check index.js
node test/client-harness.mjs   # exercises the notification logic against stubs
```

`client.js` reads the client-published session status store instead of listening to host events: client modules never receive the host `session/event` bus, and that constraint shapes the whole implementation.

## License

MIT © BillyWang (Billy王)
