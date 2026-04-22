import { useQuery } from '@tanstack/react-query'
import { portfolioService } from '@services/portfolio.service'
import { orderService } from '@services/order.service'

export function usePortfolioSummary() {
  return useQuery({
    queryKey:       ['portfolio'],
    queryFn:        () => portfolioService.getSummary().then((r) => r.data),
    refetchInterval: 5_000,
  })
}

export function useEquityCurve(days = 7) {
  return useQuery({
    queryKey:       ['equity-curve', days],
    queryFn:        () => portfolioService.getEquityCurve(days).then((r) => r.data),
    refetchInterval: 60_000,
  })
}

export function usePositions() {
  return useQuery({
    queryKey:       ['positions'],
    queryFn:        () => orderService.getPositions().then((r) => r.data),
    refetchInterval: 3_000,
  })
}

export function useOrderHistory() {
  return useQuery({
    queryKey:       ['orders'],
    queryFn:        () => orderService.getOrders().then((r) => r.data),
    refetchInterval: 10_000,
  })
}
