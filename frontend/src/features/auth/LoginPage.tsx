import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import { useLoginMutation } from '@hooks/useAuth'

const schema = z.object({
  email:     z.string().email('Invalid email address'),
  password:  z.string().min(1, 'Password is required'),
  totp_code: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const login     = useLoginMutation()
  const [need2FA, setNeed2FA] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    try {
      await login.mutateAsync(values)
    } catch (err: unknown) {
      const apiError = (err as any)?.response?.data?.error
      if (apiError === 'totp_required') setNeed2FA(true)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Sign in</h2>
        <p className="text-sm text-muted mt-1">Enter your credentials to continue</p>
      </div>

      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="trader@example.com"
        error={errors.email?.message}
        {...register('email')}
      />

      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password')}
      />

      {need2FA && (
        <Input
          label="Authenticator Code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000 000"
          error={errors.totp_code?.message}
          {...register('totp_code')}
        />
      )}

      <Button type="submit" className="w-full" loading={login.isPending}>
        Sign in
      </Button>

      <p className="text-center text-sm text-muted">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="text-gold hover:underline">
          Create one
        </Link>
      </p>
    </form>
  )
}
