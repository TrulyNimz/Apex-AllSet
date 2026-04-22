import { api } from '@/lib/api-client'
import type { ApiResponse, Candle, Instrument } from '@/types'

export const marketService = {
  getInstruments: () =>
    api.get<ApiResponse<Instrument[]>>('/instruments'),

  getCandles: (symbol: string, timeframe = '1m', limit = 500) =>
    api.get<ApiResponse<Candle[]>>(`/market/${symbol}/candles`, { timeframe, limit }),
}
