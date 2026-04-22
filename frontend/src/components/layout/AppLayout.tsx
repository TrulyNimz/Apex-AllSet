import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { wsClient } from '@/lib/ws-client'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppLayout() {
  // Open the WebSocket when the authenticated shell mounts, close on logout.
  useEffect(() => {
    wsClient.connect()
    return () => wsClient.disconnect()
  }, [])

  return (
    <div className="flex min-h-screen bg-void">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        <Topbar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
