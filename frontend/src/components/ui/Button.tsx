import { forwardRef } from 'react'
import { Spinner } from './Spinner'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?:    'sm' | 'md' | 'lg'
  loading?: boolean
}

const variants = {
  primary:   'bg-gold text-black font-semibold hover:bg-gold/90 disabled:bg-gold/50',
  secondary: 'bg-panel text-white border border-border hover:bg-surface',
  ghost:     'bg-transparent text-muted hover:text-white hover:bg-surface',
  danger:    'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded',
  md: 'px-4 py-2   text-sm rounded-md',
  lg: 'px-6 py-3   text-base rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, children, className = '', ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 font-medium
        transition-all focus:outline-none focus:ring-2 focus:ring-gold/50
        disabled:cursor-not-allowed disabled:opacity-60
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
