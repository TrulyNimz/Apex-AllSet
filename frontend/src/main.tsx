import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './app/App'
import './styles/globals.css'

// Register service worker for offline shell caching
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {/* silently fail in dev */})
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:           60_000, // 1 minute
      retry:               1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#141820',
            color:      '#fff',
            border:     '1px solid #1e2330',
          },
          success: { iconTheme: { primary: '#00d4aa', secondary: '#141820' } },
          error:   { iconTheme: { primary: '#ff4757', secondary: '#141820' } },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
)
