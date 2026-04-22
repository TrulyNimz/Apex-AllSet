import { api } from '@/lib/api-client'
import type { ApiResponse, Order, Position } from '@/types'

export interface PlaceOrderRequest {
  symbol:   string
  side:     'buy' | 'sell'
  type:     'market' | 'limit' | 'stop'
  quantity: number
  price?:   number
}

export const orderService = {
  placeOrder:   (req: PlaceOrderRequest) => api.post<ApiResponse<Order>>('/orders', req),
  cancelOrder:  (id: string)             => api.delete<void>(`/orders/${id}`),
  getOrders:    ()                       => api.get<ApiResponse<Order[]>>('/orders'),
  getPositions: ()                       => api.get<ApiResponse<Position[]>>('/positions'),
}
