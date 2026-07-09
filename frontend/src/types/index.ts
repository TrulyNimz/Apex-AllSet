// Shared interfaces mirroring the backend JSON contract.

export interface TokenPair {
  access_token: string
  refresh_token: string
  expires_at: string
}

export interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
  avatar_url: string | null
  totp_enabled: boolean
  kyc_status: string
  created_at: string
}

export interface Instrument {
  symbol: string
  base: string
  quote: string
  pip_size: number
  min_qty: number
  is_active: boolean
}

export interface Tick {
  symbol: string
  bid: number
  ask: number
  mid: number
  spread: number
  timestamp: number
}

export interface Candle {
  symbol: string
  timeframe: string
  open_time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop'

export interface Order {
  id: string
  user_id: string
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  price: number | null
  fill_price: number | null
  status: string
  filled_at: string | null
  created_at: string
}

export interface Position {
  id: string
  user_id: string
  symbol: string
  quantity: number
  avg_price: number
  realized_pnl: number
  current_price: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  side: string
  created_at: string
  updated_at: string
}

export interface PortfolioSummary {
  balance: number
  unrealized_pnl: number
  realized_pnl: number
  equity: number
  open_positions: number
}

export interface PlaceOrderInput {
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  price?: number
}

// Envelope every endpoint returns.
export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}
