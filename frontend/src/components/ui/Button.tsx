import { type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'buy' | 'sell' | 'ghost' | 'outline'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

const styles: Record<Variant, string> = {
  primary: 'bg-gold text-void hover:brightness-110',
  buy: 'bg-teal text-void hover:brightness-110',
  sell: 'bg-danger text-white hover:brightness-110',
  ghost: 'bg-transparent text-muted hover:text-white',
  outline: 'border border-border bg-transparent text-white hover:bg-panel',
}

export function Button({ variant = 'primary', loading, disabled, className = '', children, ...rest }: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    >
      {loading ? '…' : children}
    </button>
  )
}
