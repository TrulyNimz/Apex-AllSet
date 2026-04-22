import { api } from '@/lib/api-client'
import type { ApiResponse, Notification } from '@/types'

export interface NotificationListResponse {
  success:      boolean
  data:         Notification[]
  unread_count: number
}

export const notificationService = {
  getAll: () =>
    api.get<NotificationListResponse>('/notifications'),

  markRead: (id: string) =>
    api.patch<ApiResponse<null>>(`/notifications/${id}/read`),

  markAllRead: () =>
    api.post<ApiResponse<null>>('/notifications/read-all'),
}
