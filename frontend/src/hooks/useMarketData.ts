import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { marketService } from '@services/market.service'
import { orderService } from '@services/order.service'
import { portfolioService } from '@services/portfolio.service'
import { userService, type UpdateProfileInput } from '@services/user.service'
import { useAuthStore } from '@store/auth.store'
import type { PlaceOrderInput } from '@/types'

export function useInstruments() {
  return useQuery({
    queryKey: ['instruments'],
    queryFn: () => marketService.instruments(),
    staleTime: 60_000,
  })
}

export function useCandles(symbol: string, timeframe = '1m') {
  return useQuery({
    queryKey: ['candles', symbol, timeframe],
    queryFn: () => marketService.candles(symbol, timeframe),
    enabled: !!symbol,
    staleTime: 10_000,
  })
}

export function useOrders() {
  return useQuery({ queryKey: ['orders'], queryFn: () => orderService.list() })
}

export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: () => orderService.positions(),
    refetchInterval: 5_000,
  })
}

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: () => portfolioService.summary(),
    refetchInterval: 5_000,
  })
}

export function usePlaceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PlaceOrderInput) => orderService.place(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['positions'] })
      qc.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
}

export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => userService.update(input),
    onSuccess: (u) => setUser(u),
  })
}
