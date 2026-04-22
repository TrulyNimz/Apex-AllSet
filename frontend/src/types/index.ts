// All types use snake_case to mirror Go JSON responses exactly.

export interface User {
  id:           string
  first_name:   string
  last_name:    string
  email:        string
  role:         'trader' | 'admin' | 'support'
  avatar_url:   string | null
  totp_enabled: boolean
  kyc_status:   'pending' | 'submitted' | 'approved' | 'rejected'
  created_at:   string
}

export interface TokenPair {
  access_token:  string
  refresh_token: string
  expires_at:    string
}

export interface Tick {
  symbol:    string
  bid:       number
  ask:       number
  mid:       number
  spread:    number
  timestamp: number
}

export interface Instrument {
  symbol:    string
  base:      string
  quote:     string
  pip_size:  number
  min_qty:   number
  is_active: boolean
}

export interface Order {
  id:         string
  user_id:    string
  symbol:     string
  side:       'buy' | 'sell'
  type:       'market' | 'limit' | 'stop'
  quantity:   number
  price:      number | null
  fill_price: number | null
  status:     'pending' | 'open' | 'filled' | 'cancelled' | 'rejected'
  filled_at:  string | null
  created_at: string
}

export interface Position {
  id:                 string
  user_id:            string
  symbol:             string
  quantity:           number    // positive = long, negative = short
  avg_price:          number
  realized_pnl:       number
  current_price:      number
  unrealized_pnl:     number
  unrealized_pnl_pct: number
  side:               'long' | 'short'
  created_at:         string
  updated_at:         string
}

export interface Portfolio {
  balance:        number
  unrealized_pnl: number
  realized_pnl:   number
  equity:         number
  open_positions: number
}

export interface Candle {
  symbol:    string
  timeframe: string
  open_time: string
  open:      number
  high:      number
  low:       number
  close:     number
  volume:    number
}

export interface Notification {
  id:         string
  user_id:    string
  type:       string
  title:      string
  body:       string
  read:       boolean
  created_at: string
}

export interface EquityPoint {
  snapped_at:  string
  equity:      number
  balance:     number
  unrealized:  number
  realized:    number
}

export interface ApiResponse<T> {
  success:      boolean
  data:         T
  error?:       string
  unread_count?: number
}
