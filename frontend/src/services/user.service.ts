import { api } from '@/lib/api-client'
import type { ApiResponse, User } from '@/types'

export interface UpdateProfileInput {
  first_name?: string
  last_name?: string
  avatar_url?: string
}

export const userService = {
  async update(input: UpdateProfileInput): Promise<User> {
    const res = await api.patch<ApiResponse<User>>('/users/me', input)
    return res.data.data
  },
}
