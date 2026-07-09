import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@hooks/useAuth'
import { AuthLayout } from '@components/layout/AuthLayout'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'

export default function LoginPage() {
  const { login, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await login({ email, password })
    } catch {
      /* error toast shown by the hook */
    }
  }

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back to Apex Trading">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" loading={loading}>
          Sign In
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        No account?{' '}
        <Link to="/register" className="text-gold hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  )
}
