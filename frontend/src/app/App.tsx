import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@store/auth.store'
import { AppLayout } from '@components/layout/AppLayout'
import { AuthLayout } from '@components/layout/AuthLayout'
import { LoginPage } from '@features/auth/LoginPage'
import { RegisterPage } from '@features/auth/RegisterPage'
import { DashboardPage } from '@features/dashboard/DashboardPage'
import { TradingPage } from '@features/trading/TradingPage'
import { PortfolioPage } from '@features/portfolio/PortfolioPage'
import { JournalPage } from '@features/journal/JournalPage'
import { SettingsPage } from '@features/settings/SettingsPage'

function RequireAuth() {
  const token = useAuthStore((s) => s.accessToken)
  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}

function RequireGuest() {
  const token = useAuthStore((s) => s.accessToken)
  if (token) return <Navigate to="/" replace />
  return <Outlet />
}

const router = createBrowserRouter([
  // ── Guest-only ──────────────────────────────────────────────────────────────
  {
    element: <RequireGuest />,
    children: [{
      element: <AuthLayout />,
      children: [
        { path: '/login',    element: <LoginPage /> },
        { path: '/register', element: <RegisterPage /> },
      ],
    }],
  },

  // ── Protected ───────────────────────────────────────────────────────────────
  {
    element: <RequireAuth />,
    children: [{
      element: <AppLayout />,
      children: [
        { path: '/',                element: <DashboardPage /> },
        { path: '/trading/:symbol', element: <TradingPage /> },
        { path: '/portfolio',       element: <PortfolioPage /> },
        { path: '/journal',   element: <JournalPage /> },
        { path: '/settings',  element: <SettingsPage /> },
      ],
    }],
  },

  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
