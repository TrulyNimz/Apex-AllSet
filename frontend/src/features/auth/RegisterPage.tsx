import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import { useRegisterMutation } from '@hooks/useAuth'

const schema = z.object({
  first_name: z.string().min(2, 'Minimum 2 characters').max(50),
  last_name:  z.string().min(2, 'Minimum 2 characters').max(50),
  email:      z.string().email('Invalid email address'),
  password:   z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
})

type FormValues = z.infer<typeof schema>

export function RegisterPage() {
  const register_ = useRegisterMutation()

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  return (
    <form onSubmit={handleSubmit((v) => register_.mutate(v))} className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Create account</h2>
        <p className="text-sm text-muted mt-1">Start trading in seconds</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="First name"
          autoComplete="given-name"
          placeholder="John"
          error={errors.first_name?.message}
          {...register('first_name')}
        />
        <Input
          label="Last name"
          autoComplete="family-name"
          placeholder="Doe"
          error={errors.last_name?.message}
          {...register('last_name')}
        />
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
        autoComplete="new-password"
        placeholder="Min 8 chars, uppercase + number"
        error={errors.password?.message}
        {...register('password')}
      />

      <Button type="submit" className="w-full" loading={register_.isPending}>
        Create account
      </Button>

      <p className="text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="text-gold hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
