import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '@store/auth.store'
import { apiError } from '@/lib/api-client'
import { authService, type LoginInput, type RegisterInput } from '@services/auth.service'

/** Auth actions with token persistence, profile hydration, and navigation. */
export function useAuth() {
  const navigate = useNavigate()
  const setTokens = useAuthStore((s) => s.setTokens)
  const setUser = useAuthStore((s) => s.setUser)
  const clear = useAuthStore((s) => s.clear)
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(false)

  async function hydrateAndGo() {
    const me = await authService.me()
    setUser(me)
    navigate('/')
  }

  async function login(input: LoginInput) {
    setLoading(true)
    try {
      const pair = await authService.login(input)
      setTokens(pair.access_token, pair.refresh_token)
      await hydrateAndGo()
    } catch (err) {
      toast.error(apiError(err))
      throw err
    } finally {
      setLoading(false)
    }
  }

  async function register(input: RegisterInput) {
    setLoading(true)
    try {
      const pair = await authService.register(input)
      setTokens(pair.access_token, pair.refresh_token)
      await hydrateAndGo()
    } catch (err) {
      toast.error(apiError(err))
      throw err
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    try {
      await authService.logout()
    } catch {
      /* best-effort; clear locally regardless */
    }
    clear()
    navigate('/login')
  }

  return { login, register, logout, loading, user }
}
