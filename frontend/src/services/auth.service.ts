import { api } from '@/lib/api-client'
import type { ApiResponse, TokenPair, User } from '@/types'

export interface RegisterRequest {
  first_name: string
  last_name:  string
  email:      string
  password:   string
}

export interface LoginRequest {
  email:      string
  password:   string
  totp_code?: string
}

export interface UpdateProfileRequest {
  first_name?: string
  last_name?:  string
  avatar_url?: string
}

export const authService = {
  register:   (req: RegisterRequest)       => api.post<ApiResponse<TokenPair>>('/auth/register', req),
  login:      (req: LoginRequest)          => api.post<ApiResponse<TokenPair>>('/auth/login', req),
  logout:     ()                           => api.post<void>('/auth/logout'),
  setup2FA:   ()                           => api.post<ApiResponse<{ secret: string; otp_url: string }>>('/auth/2fa/setup'),
  verify2FA:  (code: string)               => api.post<void>('/auth/2fa/verify', { code }),
  disable2FA: (code: string)               => api.post<void>('/auth/2fa/disable', { code }),
  getMe:      ()                           => api.get<ApiResponse<User>>('/users/me'),
  updateMe:   (req: UpdateProfileRequest)  => api.patch<ApiResponse<User>>('/users/me', req),
}
