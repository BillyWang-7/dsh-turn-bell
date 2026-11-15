const calls = { opened: [], focused: 0, posted: [] }
const instances = []
const listeners = new Set()
const status = new Map()
const rows = {
  s1: { title: '后台任务', origin: 'main', retainedBy: { mainView: 0 } },
  s2: { title: '当前会话', retainedBy: { mainView: 1 } },
}

globalThis.document = { visibilityState: 'visible', hasFocus: () => false }

globalThis.window = { focus: () => { calls.focused += 1 } }
globalThis.Notification = class {
  static permission = 'granted'
  constructor(title, options) {
    calls.posted.push({ title, body: options.body, tag: options.tag })
    instances.push(this)
    this.onclick = null
  }
  close() {}
}
globalThis.window.__ModuleLoader__ = { load({ factory }) { globalThis.__module = factory() } }

const statusStore = {
  getSnapshot: () => status,
  subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
}
const sessions = {
  list: { getSnapshot: () => ({ current: 's2', phase: 'ready', ids: ['s1', 's2'], byId: rows }), subscribe: () => () => {} },
}
let language = 'zh'
const ctx = {
  get(name) {
    if (name === 'sessions') return sessions
    if (name === 'uiSession') return { sessionStatus: statusStore }
    if (name === 'uiWorkspace') return { openSession: (id) => calls.opened.push(id) }
    if (name === 'locale') return { getLocale: () => ({ active: language }) }
    return undefined
  },
  inject(_deps, fn) { fn(ctx) },
  effect(fn) { return fn() },
  sessions,
}

await import('../client.js')
globalThis.__module.apply(ctx)
const emit = () => { for (const fn of listeners) fn() }

status.set('s1', { running: false }); status.set('s2', { running: false }); emit()
status.set('s1', { running: true }); emit()
status.set('s1', { running: false }); emit()
status.set('s1', { running: false, pendingInteraction: 'approval' }); emit()

console.log('posted:', JSON.stringify(calls.posted))
if (calls.posted.length !== 2) throw new Error('expected 2 banners, got ' + calls.posted.length)
if (calls.posted[0].body !== '回答已完成' || calls.posted[1].body !== '需要你确认或回答') throw new Error('wrong zh copy')

instances[0].onclick()
if (calls.opened[0] !== 's1') throw new Error('banner did not open its session: ' + JSON.stringify(calls.opened))
if (calls.focused !== 1) throw new Error('window was not focused')

language = 'en'
status.set('s1', { running: true }); emit()
status.set('s1', { running: false }); emit()
if (calls.posted.at(-1).body !== 'Turn finished') throw new Error('wrong en copy: ' + calls.posted.at(-1).body)

// focused window on the same session stays quiet
globalThis.document.hasFocus = () => true
status.set('s2', { running: true }); emit()
status.set('s2', { running: false }); emit()
if (calls.posted.length !== 3) throw new Error('focused current session should not notify, got ' + calls.posted.length)

// subagent sessions stay silent
rows.s3 = { title: '子代理', origin: 'subagent' }
status.set('s3', { running: true }); emit()
status.set('s3', { running: false }); emit()
if (calls.posted.length !== 3) throw new Error('subagent should stay silent')

console.log('harness ok')
