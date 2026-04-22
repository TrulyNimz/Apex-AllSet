import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { authService } from '@services/auth.service'
import { useCurrentUser } from '@hooks/useAuth'
import { useAuthStore } from '@store/auth.store'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'

// ── Profile tab ───────────────────────────────────────────────────────────────

const profileSchema = z.object({
  first_name: z.string().min(2, 'Min 2 chars').max(50),
  last_name:  z.string().min(2, 'Min 2 chars').max(50),
})
type ProfileForm = z.infer<typeof profileSchema>

function ProfileTab() {
  const { data: user } = useCurrentUser()
  const qc = useQueryClient()
  const setUser = useAuthStore((s) => s.setUser)

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: { first_name: user?.first_name ?? '', last_name: user?.last_name ?? '' },
  })

  const update = useMutation({
    mutationFn: (data: ProfileForm) => authService.updateMe(data),
    onSuccess: (res) => {
      setUser(res.data)
      qc.invalidateQueries({ queryKey: ['users', 'me'] })
      toast.success('Profile updated')
    },
    onError: () => toast.error('Update failed'),
  })

  return (
    <div className="max-w-md space-y-4">
      <h2 className="text-base font-semibold text-white">Profile</h2>
      <form onSubmit={handleSubmit((d) => update.mutate(d))} className="space-y-4">
        <Input
          label="First Name"
          {...register('first_name')}
          error={errors.first_name?.message}
        />
        <Input
          label="Last Name"
          {...register('last_name')}
          error={errors.last_name?.message}
        />
        <div>
          <label className="block text-xs text-muted mb-1">Email</label>
          <p className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-muted font-mono">
            {user?.email}
          </p>
        </div>
        <Button type="submit" loading={update.isPending}>Save Changes</Button>
      </form>
    </div>
  )
}

// ── 2FA flow ──────────────────────────────────────────────────────────────────

function TwoFASection() {
  const { data: user } = useCurrentUser()
  const qc = useQueryClient()
  const setUser = useAuthStore((s) => s.setUser)

  const [step, setStep]     = useState<'idle' | 'setup' | 'verify' | 'disable'>('idle')
  const [qrUrl, setQrUrl]   = useState('')
  const [code, setCode]     = useState('')

  const setup = useMutation({
    mutationFn: () => authService.setup2FA(),
    onSuccess: (res) => {
      setQrUrl(res.data.otp_url)
      setStep('setup')
    },
    onError: () => toast.error('Failed to setup 2FA'),
  })

  const verify = useMutation({
    mutationFn: (c: string) => authService.verify2FA(c),
    onSuccess: async () => {
      toast.success('2FA enabled')
      const profile = await authService.getMe()
      setUser(profile.data)
      qc.invalidateQueries({ queryKey: ['users', 'me'] })
      setStep('idle')
      setCode('')
    },
    onError: () => toast.error('Invalid code'),
  })

  const disable = useMutation({
    mutationFn: (c: string) => authService.disable2FA(c),
    onSuccess: async () => {
      toast.success('2FA disabled')
      const profile = await authService.getMe()
      setUser(profile.data)
      qc.invalidateQueries({ queryKey: ['users', 'me'] })
      setStep('idle')
      setCode('')
    },
    onError: () => toast.error('Invalid code'),
  })

  if (!user) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Two-Factor Authentication</p>
          <p className="text-xs text-muted mt-0.5">
            {user.totp_enabled ? 'Enabled — your account is protected with TOTP.' : 'Disabled — add extra security to your account.'}
          </p>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${user.totp_enabled ? 'bg-teal/20 text-teal' : 'bg-surface text-muted'}`}>
          {user.totp_enabled ? 'ON' : 'OFF'}
        </span>
      </div>

      {step === 'idle' && (
        user.totp_enabled ? (
          <Button variant="danger" size="sm" onClick={() => setStep('disable')}>
            Disable 2FA
          </Button>
        ) : (
          <Button size="sm" onClick={() => setup.mutate()} loading={setup.isPending}>
            Enable 2FA
          </Button>
        )
      )}

      {step === 'setup' && qrUrl && (
        <div className="space-y-3">
          <p className="text-xs text-muted">Scan this QR code with your authenticator app:</p>
          <div className="bg-white p-3 rounded-xl inline-block">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}`}
              alt="TOTP QR Code"
              width={180}
              height={180}
            />
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                label="Verify code from app"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
              />
            </div>
            <Button onClick={() => verify.mutate(code)} loading={verify.isPending}>
              Verify
            </Button>
            <Button variant="ghost" onClick={() => setStep('idle')}>Cancel</Button>
          </div>
        </div>
      )}

      {step === 'disable' && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              label="Enter your current TOTP code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              maxLength={6}
            />
          </div>
          <Button variant="danger" onClick={() => disable.mutate(code)} loading={disable.isPending}>
            Disable
          </Button>
          <Button variant="ghost" onClick={() => setStep('idle')}>Cancel</Button>
        </div>
      )}
    </div>
  )
}

function SecurityTab() {
  return (
    <div className="max-w-md space-y-6">
      <h2 className="text-base font-semibold text-white">Security</h2>
      <TwoFASection />
      <div className="border-t border-border pt-6 space-y-3">
        <p className="text-sm font-medium text-white">Change Password</p>
        <p className="text-xs text-muted">Password changes are coming in a future update.</p>
        <Button disabled variant="secondary" size="sm">Change Password — Coming Soon</Button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'security'

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile')

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-white">Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        {(['profile', 'security'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-panel text-white shadow' : 'text-muted hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-panel border border-border rounded-xl p-6">
        {tab === 'profile'  && <ProfileTab />}
        {tab === 'security' && <SecurityTab />}
      </div>
    </div>
  )
}
