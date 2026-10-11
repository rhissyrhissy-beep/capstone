// Live "something changed" pings from the FastAPI WebSocket.
// The server only says WHICH table changed; callers re-fetch through the normal REST endpoints.
import { getToken, wsUrl } from './api'

const listeners = new Set()
let socket = null
let retryTimer = null
let pingTimer = null
let attempts = 0

function open() {
  const token = getToken()
  if (socket || !token || listeners.size === 0) return
  const ws = new WebSocket(`${wsUrl}/ws?token=${encodeURIComponent(token)}`)
  socket = ws

  ws.onopen = () => {
    const reconnected = attempts > 0
    attempts = 0
    pingTimer = setInterval(() => { try { ws.send('ping') } catch { /* closing */ } }, 25000)
    // anything that changed while we were disconnected: let every listener refresh once
    if (reconnected) listeners.forEach((l) => l.callback({ table: '*' }))
  }
  ws.onmessage = (message) => {
    let event
    try { event = JSON.parse(message.data) } catch { return }
    listeners.forEach((l) => { if (l.tables.includes(event.table)) l.callback(event) })
  }
  ws.onclose = (event) => {
    clearInterval(pingTimer)
    if (socket === ws) socket = null
    if (event.code === 4401 || event.code === 4403) return // bad / revoked token: do not retry
    if (listeners.size > 0 && getToken()) {
      attempts += 1
      retryTimer = setTimeout(open, Math.min(30000, 1000 * 2 ** Math.min(attempts, 5)))
    }
  }
  ws.onerror = () => ws.close()
}

export function subscribe(tables, callback) {
  const listener = { tables: Array.isArray(tables) ? tables : [tables], callback }
  listeners.add(listener)
  open()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) resetRealtime()
  }
}

/** Call after sign-in / sign-out so the socket always uses the current token. */
export function resetRealtime() {
  clearTimeout(retryTimer)
  clearInterval(pingTimer)
  attempts = 0
  if (socket) { const old = socket; socket = null; old.onclose = null; old.close() }
  if (listeners.size > 0) open()
}
