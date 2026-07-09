import { useState, type FormEvent, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@store/auth.store'
import { useUpdateProfile } from '@hooks/useMarketData'
import { authService } from '@services/auth.service'
import { apiError } from '@/lib/api-client'
import { Card } from '@components/ui/Card'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'

type Tab = 'profile' | 'security'

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile')

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl text-white">Settings</h1>

      <div className="flex gap-2">
        <TabButton active={tab === 'profile'} onClick={() => setTab('profile')}>
          Profile
        </TabButton>
        <TabButton active={tab === 'security'} onClick={() => setTab('security')}>
          Security
        </TabButton>
      </div>

      {tab === 'profile' ? <ProfileTab /> : <SecurityTab />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-panel text-white' : 'text-muted hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function ProfileTab() {
  const user = useAuthStore((s) => s.user)
  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName, setLastName] = useState(user?.last_name ?? '')
  const update = useUpdateProfile()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await update.mutateAsync({ first_name: firstName, last_name: lastName })
      toast.success('Profile updated')
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  return (
    <Card className="max-w-md p-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <Input label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <Input label="Email" value={user?.email ?? ''} disabled />
        <Button type="submit" loading={update.isPending}>
          Save Changes
        </Button>
      </form>
    </Card>
  )
}

function SecurityTab() {
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)

  async function enable() {
    setLoading(true)
    try {
      const res = await authService.setup2FA()
      setSecret(res.secret)
      toast.success('Scan the secret in your authenticator app, then verify')
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-md p-6">
      <h2 className="text-sm font-semibold text-white">Two-Factor Authentication</h2>
      <p className="mt-1 text-sm text-muted">Add a TOTP authenticator app for extra security.</p>

      {user?.totp_enabled ? (
        <Badge tone="teal" className="mt-4">
          Enabled
        </Badge>
      ) : (
        <>
          <Button className="mt-4" loading={loading} onClick={enable}>
            Enable 2FA
          </Button>
          {secret && (
            <div className="mt-4 rounded-md border border-border bg-deep p-3 text-xs text-muted">
              Secret: <span className="tnum text-white">{secret}</span>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
