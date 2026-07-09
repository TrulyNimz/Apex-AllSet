import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@store/auth.store'
import AppLayout from '@components/layout/AppLayout'
import LoginPage from '@features/auth/LoginPage'
import RegisterPage from '@features/auth/RegisterPage'
import DashboardPage from '@features/dashboard/DashboardPage'
import TradingPage from '@features/trading/TradingPage'
import PortfolioPage from '@features/portfolio/PortfolioPage'
import JournalPage from '@features/journal/JournalPage'
import SettingsPage from '@features/settings/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 },
  },
})

function ProtectedRoute() {
  const authenticated = useAuthStore((s) => !!s.accessToken)
  return authenticated ? <Outlet /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/trading/:symbol" element={<TradingPage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/journal" element={<JournalPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#141820', color: '#fff', border: '1px solid #1e2530' },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
