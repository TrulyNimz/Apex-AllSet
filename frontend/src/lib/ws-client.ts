import { useAuthStore } from '@store/auth.store'
import type { Tick } from '@/types'

type TickHandler = (tick: Tick) => void

/**
 * Singleton WebSocket client for live price ticks. One connection per session:
 * - reconnects with exponential backoff (max 30s)
 * - re-subscribes to all active symbols after reconnect
 * - sends a keep-alive ping every 20s
 * - exposes subscribe(symbol, handler) returning an unsubscribe function
 */
class WSClient {
  private ws: WebSocket | null = null
  private handlers = new Map<string, Set<TickHandler>>()
  private backoff = 1_000
  private pingTimer: number | undefined
  private connecting = false

  private buildURL(): string {
    const token = useAuthStore.getState().accessToken ?? ''
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    // Same-origin — proxied to the backend by Vite/Nginx.
    return `${proto}://${window.location.host}/api/v1/ws/prices?token=${encodeURIComponent(token)}`
  }

  private connect(): void {
    if (this.connecting || this.ws) return
    this.connecting = true

    const ws = new WebSocket(this.buildURL())
    this.ws = ws

    ws.onopen = () => {
      this.connecting = false
      this.backoff = 1_000
      for (const symbol of this.handlers.keys()) {
        this.send({ type: 'subscribe', symbol })
      }
      this.pingTimer = window.setInterval(() => this.send({ type: 'ping' }), 20_000)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string)
        if (msg.type === 'tick' && msg.data) {
          this.handlers.get(msg.symbol)?.forEach((h) => h(msg.data as Tick))
        }
      } catch {
        /* ignore malformed frames */
      }
    }

    ws.onclose = () => {
      this.connecting = false
      if (this.pingTimer) window.clearInterval(this.pingTimer)
      this.ws = null
      this.scheduleReconnect()
    }

    ws.onerror = () => ws.close()
  }

  private scheduleReconnect(): void {
    if (this.handlers.size === 0) return
    const delay = this.backoff
    this.backoff = Math.min(this.backoff * 2, 30_000)
    window.setTimeout(() => this.connect(), delay)
  }

  private send(payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }

  subscribe(symbol: string, handler: TickHandler): () => void {
    let set = this.handlers.get(symbol)
    if (!set) {
      set = new Set()
      this.handlers.set(symbol, set)
    }
    set.add(handler)

    if (!this.ws) {
      this.connect()
    } else {
      this.send({ type: 'subscribe', symbol })
    }

    return () => {
      const current = this.handlers.get(symbol)
      if (!current) return
      current.delete(handler)
      if (current.size === 0) {
        this.handlers.delete(symbol)
        this.send({ type: 'unsubscribe', symbol })
      }
    }
  }
}

export const wsClient = new WSClient()
