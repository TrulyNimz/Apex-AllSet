import { api } from '@/lib/api-client'
import type { ApiResponse, TokenPair, User } from '@/types'

export interface RegisterInput {
  first_name: string
  last_name: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
  totp_code?: string
}

export const authService = {
  async register(input: RegisterInput): Promise<TokenPair> {
    const res = await api.post<ApiResponse<TokenPair>>('/auth/register', input)
    return res.data.data
  },

  async login(input: LoginInput): Promise<TokenPair> {
    const res = await api.post<ApiResponse<TokenPair>>('/auth/login', input)
    return res.data.data
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
  },

  async me(): Promise<User> {
    const res = await api.get<ApiResponse<User>>('/users/me')
    return res.data.data
  },

  async setup2FA(): Promise<{ secret: string; otp_url: string }> {
    const res = await api.post<ApiResponse<{ secret: string; otp_url: string }>>('/auth/2fa/setup')
    return res.data.data
  },
}
