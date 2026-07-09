import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@store/auth.store'
import type { ApiResponse, TokenPair } from '@/types'

/**
 * Axios instance for the v1 API. Uses a relative baseURL so requests flow
 * through the Vite dev proxy (and the Nginx proxy in production) — same-origin,
 * no CORS.
 */
export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Single-flight refresh so concurrent 401s trigger only one refresh call.
let refreshing: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState()
  if (!refreshToken) {
    clear()
    return null
  }
  try {
    const res = await axios.post<ApiResponse<TokenPair>>('/api/v1/auth/refresh', {
      refresh_token: refreshToken,
    })
    const pair = res.data.data
    setTokens(pair.access_token, pair.refresh_token)
    return pair.access_token
  } catch {
    clear()
    return null
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const status = error.response?.status
    const url = original?.url ?? ''

    // Never try to refresh for auth endpoints — a 401 there is a real credential error.
    const isAuthCall = url.includes('/auth/')

    if (status === 401 && original && !isAuthCall && !original._retry) {
      original._retry = true
      refreshing = refreshing ?? refreshAccessToken()
      const newToken = await refreshing
      refreshing = null

      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      }
      // Refresh failed — bounce to login.
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

/** Extracts a human-readable message from an API error. */
export function apiError(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined
    return data?.error ?? err.message ?? fallback
  }
  return fallback
}
