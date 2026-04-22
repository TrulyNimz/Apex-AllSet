import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-5xl text-gold tracking-widest">APEX</h1>
          <p className="text-muted text-sm mt-1">Multi-asset trading platform</p>
        </div>

        <div className="bg-panel border border-border rounded-2xl p-8 shadow-2xl">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
