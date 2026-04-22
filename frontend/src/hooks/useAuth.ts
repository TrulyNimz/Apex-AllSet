import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authService, type LoginRequest, type RegisterRequest } from '@services/auth.service'
import { useAuthStore } from '@store/auth.store'

export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: ['users', 'me'],
    queryFn:  () => authService.getMe().then((r) => r.data),
    enabled:  !!accessToken,
  })
}

export function useLoginMutation() {
  const { setTokens, setUser } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (req: LoginRequest) => authService.login(req),
    onSuccess: async (res) => {
      setTokens(res.data.access_token, res.data.refresh_token)
      const profile = await authService.getMe()
      setUser(profile.data)
      navigate('/')
    },
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.error ?? 'Login failed'
      if (msg !== 'totp_required') toast.error(msg)
    },
  })
}

export function useRegisterMutation() {
  const { setTokens, setUser } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (req: RegisterRequest) => authService.register(req),
    onSuccess: async (res) => {
      setTokens(res.data.access_token, res.data.refresh_token)
      const profile = await authService.getMe()
      setUser(profile.data)
      navigate('/')
    },
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.error ?? 'Registration failed'
      toast.error(msg)
    },
  })
}

export function useLogoutMutation() {
  const { logout } = useAuthStore()
  const navigate   = useNavigate()
  const qc         = useQueryClient()

  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      logout()
      qc.clear()
      navigate('/login')
    },
  })
}
