import { api } from '@/lib/api-client'
import type { ApiResponse, Candle, Instrument } from '@/types'

export const marketService = {
  async instruments(): Promise<Instrument[]> {
    const res = await api.get<ApiResponse<Instrument[]>>('/instruments')
    return res.data.data ?? []
  },

  async candles(symbol: string, timeframe = '1m', limit = 500): Promise<Candle[]> {
    const res = await api.get<ApiResponse<Candle[]>>(`/market/${symbol}/candles`, {
      params: { timeframe, limit },
    })
    return res.data.data ?? []
  },
}
