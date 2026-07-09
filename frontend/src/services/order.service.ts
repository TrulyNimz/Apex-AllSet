import { api } from '@/lib/api-client'
import type { ApiResponse, Order, PlaceOrderInput, Position } from '@/types'

export const orderService = {
  async place(input: PlaceOrderInput): Promise<Order> {
    const res = await api.post<ApiResponse<Order>>('/orders', input)
    return res.data.data
  },

  async list(): Promise<Order[]> {
    const res = await api.get<ApiResponse<Order[]>>('/orders')
    return res.data.data ?? []
  },

  async cancel(id: string): Promise<void> {
    await api.delete(`/orders/${id}`)
  },

  async positions(): Promise<Position[]> {
    const res = await api.get<ApiResponse<Position[]>>('/positions')
    return res.data.data ?? []
  },
}
