import { api } from '@/lib/api-client'
import type { ApiResponse, PortfolioSummary } from '@/types'

export const portfolioService = {
  async summary(): Promise<PortfolioSummary> {
    const res = await api.get<ApiResponse<PortfolioSummary>>('/portfolio')
    return res.data.data
  },
}
