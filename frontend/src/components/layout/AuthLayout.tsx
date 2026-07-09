import { type ReactNode } from 'react'

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-full items-center justify-center bg-void p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-display text-4xl tracking-wide text-gold">APEX</div>
          <h1 className="mt-4 font-serif text-2xl text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="rounded-lg border border-border bg-surface p-6">{children}</div>
      </div>
    </div>
  )
}
