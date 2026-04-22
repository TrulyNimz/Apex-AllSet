import { api } from '@/lib/api-client'
import type { ApiResponse, EquityPoint, Portfolio } from '@/types'

export const portfolioService = {
  getSummary:     () => api.get<ApiResponse<Portfolio>>('/portfolio'),
  getEquityCurve: (days = 7) =>
    api.get<ApiResponse<EquityPoint[]>>('/portfolio/equity-curve', { days }),
}
