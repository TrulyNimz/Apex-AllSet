import { useRef, useState, useEffect } from 'react'
import { useAuthStore } from '@store/auth.store'
import { useThemeStore } from '@store/theme.store'
import { useLogoutMutation } from '@hooks/useAuth'
import { useNotifications, useMarkAllRead, useMarkRead } from '@hooks/useNotifications'
import { Button } from '@components/ui/Button'

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

export function Topbar() {
  const user      = useAuthStore((s) => s.user)
  const logout    = useLogoutMutation()
  const { theme, toggle: toggleTheme } = useThemeStore()
  const [open, setOpen] = useState(false)
  const dropRef   = useRef<HTMLDivElement>(null)

  const { data: notifRes } = useNotifications()
  const markRead    = useMarkRead()
  const markAllRead = useMarkAllRead()

  const notifications  = notifRes?.data ?? []
  const unreadCount    = notifRes?.unread_count ?? 0

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header className="h-14 bg-deep border-b border-border flex items-center justify-between px-6 shrink-0">
      {/* WS connection indicator */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-teal animate-pulse" />
        <span className="text-xs text-muted font-mono">LIVE</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 text-muted hover:text-white transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Notification bell */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="relative p-1.5 text-muted hover:text-white transition-colors"
          >
            <BellIcon />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-9 w-80 bg-panel border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold text-white">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="text-xs text-gold hover:text-gold/80 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted">No notifications yet</p>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.read && markRead.mutate(n.id)}
                      className={`px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-surface/50 transition-colors ${n.read ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gold shrink-0" />}
                        <div className={n.read ? 'ml-3.5' : ''}>
                          <p className="text-xs font-medium text-white">{n.title}</p>
                          <p className="text-xs text-muted mt-0.5">{n.body}</p>
                          <p className="text-[10px] text-muted/60 mt-1">
                            {new Date(n.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <span className="text-sm text-muted hidden sm:block">{user?.email}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout.mutate()}
          loading={logout.isPending}
        >
          Sign out
        </Button>
      </div>
    </header>
  )
}
