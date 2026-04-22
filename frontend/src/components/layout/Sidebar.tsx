import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuthStore } from '@store/auth.store'
import { Badge } from '@components/ui/Badge'

const navItems = [
  { to: '/',               label: 'Dashboard', end: true  },
  { to: '/trading/EURUSD', label: 'Trading',   end: false },
  { to: '/portfolio',      label: 'Portfolio', end: false },
  { to: '/journal',        label: 'Journal',   end: false },
  { to: '/settings',       label: 'Settings',  end: false },
]

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {open
        ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
        : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
      }
    </svg>
  )
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {navItems.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) => `
            flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
            ${isActive
              ? 'bg-gold/10 text-gold border border-gold/20'
              : 'text-muted hover:text-white hover:bg-surface border border-transparent'
            }
          `}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function UserChip() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  return (
    <div className="px-4 py-4 border-t border-border">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center
                        text-gold text-xs font-bold shrink-0">
          {user.first_name[0]}{user.last_name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {user.first_name} {user.last_name}
          </p>
          <Badge variant="gold" className="mt-0.5 capitalize">{user.role}</Badge>
        </div>
      </div>
    </div>
  )
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* ── Desktop sidebar (lg+) ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-60 min-h-screen bg-deep border-r border-border flex-col shrink-0">
        <div className="px-6 py-5 border-b border-border">
          <h1 className="font-display text-2xl text-gold tracking-widest">APEX</h1>
          <p className="text-muted text-xs mt-0.5">Trading Platform</p>
        </div>
        <NavItems />
        <UserChip />
      </aside>

      {/* ── Mobile topbar trigger (< lg) ─────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-deep border-b border-border
                      flex items-center justify-between px-4">
        <h1 className="font-display text-xl text-gold tracking-widest">APEX</h1>
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="p-1.5 text-muted hover:text-white transition-colors"
          aria-label="Toggle menu"
        >
          <HamburgerIcon open={mobileOpen} />
        </button>
      </div>

      {/* ── Mobile drawer ────────────────────────────────────────────────────── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-void/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer panel */}
          <aside className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-64 bg-deep border-r border-border flex flex-col">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h1 className="font-display text-2xl text-gold tracking-widest">APEX</h1>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 text-muted hover:text-white transition-colors"
              >
                <HamburgerIcon open />
              </button>
            </div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
            <UserChip />
          </aside>
        </>
      )}

      {/* Spacer so main content doesn't go under mobile topbar */}
      <div className="lg:hidden h-14 shrink-0" />
    </>
  )
}
