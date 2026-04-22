import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { orderService, type PlaceOrderRequest } from '@services/order.service'

export function usePlaceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: PlaceOrderRequest) => orderService.placeOrder(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['portfolio'] })
    },
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.error ?? 'Order failed'
      toast.error(msg)
    },
  })
}

export function useCancelOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => orderService.cancelOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.error ?? 'Cancel failed'
      toast.error(msg)
    },
  })
}
