import { type Tick } from '@/types'
import { useAuthStore } from '@store/auth.store'

type MessageHandler<T> = (data: T) => void

interface WSMessage {
  type:    'tick' | 'pong' | 'error' | 'subscribed'
  symbol?: string
  data?:   unknown
}

// ── WebSocket Client ──────────────────────────────────────────────────────────
class ApexWebSocket {
  private ws:              WebSocket | null = null
  private subscriptions:   Map<string, Set<MessageHandler<Tick>>> = new Map()
  private reconnectTimer:  ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private pingInterval:    ReturnType<typeof setInterval> | null = null
  private isIntentionallyClosed = false

  private get wsUrl(): string {
    const base   = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080'
    const token  = useAuthStore.getState().accessToken ?? ''
    return `${base}/api/v1/ws/prices?token=${token}`
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return

    this.isIntentionallyClosed = false
    this.ws = new WebSocket(this.wsUrl)

    this.ws.onopen = () => {
      console.info('[WS] Connected')
      this.reconnectAttempts = 0

      // Re-subscribe to all active symbols after reconnect
      for (const symbol of this.subscriptions.keys()) {
        this.sendSubscribe(symbol)
      }

      // Keep-alive ping every 20s
      this.pingInterval = setInterval(() => {
        this.send({ type: 'ping' })
      }, 20_000)
    }

    this.ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage
        this.handleMessage(msg)
      } catch {
        // silently ignore malformed frames
      }
    }

    this.ws.onclose = () => {
      this.clearPing()
      if (!this.isIntentionallyClosed) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = (err) => {
      console.error('[WS] Error', err)
    }
  }

  disconnect(): void {
    this.isIntentionallyClosed = true
    this.clearPing()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    this.ws?.close()
    this.ws = null
  }

  subscribe(symbol: string, handler: MessageHandler<Tick>): () => void {
    if (!this.subscriptions.has(symbol)) {
      this.subscriptions.set(symbol, new Set())
      // Only send WS subscribe if connection is open
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendSubscribe(symbol)
      }
    }
    this.subscriptions.get(symbol)!.add(handler)

    // Return unsubscribe function
    return () => {
      const handlers = this.subscriptions.get(symbol)
      if (!handlers) return
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.subscriptions.delete(symbol)
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.send({ type: 'unsubscribe', symbol })
        }
      }
    }
  }

  private handleMessage(msg: WSMessage): void {
    if (msg.type === 'tick' && msg.symbol && msg.data) {
      const handlers = this.subscriptions.get(msg.symbol)
      handlers?.forEach((fn) => fn(msg.data as Tick))
    }
  }

  private sendSubscribe(symbol: string): void {
    this.send({ type: 'subscribe', symbol })
  }

  private send(payload: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnect attempts reached')
      return
    }
    // Exponential backoff: 1s, 2s, 4s, 8s … max 30s
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000)
    this.reconnectAttempts++
    console.info(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private clearPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }
}

// Singleton — one WS connection for the whole app
export const wsClient = new ApexWebSocket()
