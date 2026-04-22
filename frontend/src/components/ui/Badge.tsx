interface BadgeProps {
  variant?:   'success' | 'danger' | 'warning' | 'neutral' | 'gold'
  children:   React.ReactNode
  className?: string
}

const variants = {
  success: 'bg-teal/10   text-teal    border-teal/20',
  danger:  'bg-danger/10 text-danger  border-danger/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  neutral: 'bg-surface   text-muted   border-border',
  gold:    'bg-gold/10   text-gold    border-gold/20',
}

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span className={`
      inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border
      ${variants[variant]} ${className}
    `}>
      {children}
    </span>
  )
}
