import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuthStore } from '@store/auth.store'
import { authService } from '@services/auth.service'
import { useAuth } from '@hooks/useAuth'
import { Button } from '@components/ui/Button'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/portfolio', label: 'Portfolio', end: false },
  { to: '/journal', label: 'Journal', end: false },
  { to: '/settings', label: 'Settings', end: false },
]

export default function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const { logout } = useAuth()

  // Hydrate the profile once — tokens may have been restored from a prior session.
  useEffect(() => {
    authService
      .me()
      .then(setUser)
      .catch(() => {
        /* interceptor handles auth failures */
      })
  }, [setUser])

  return (
    <div className="flex h-full">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-deep p-4 md:flex">
        <div className="mb-8 font-display text-2xl tracking-wide text-gold">APEX</div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm transition ${
                  isActive ? 'bg-panel text-white' : 'text-muted hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center border-b border-border bg-deep px-4 py-3">
          <div className="font-display text-xl text-gold md:hidden">APEX</div>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm text-muted">{user?.email}</span>
            <Button variant="outline" onClick={logout}>
              Sign out
            </Button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
