import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:  string
  error?:  string
  helper?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-muted uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`
          w-full px-3 py-2 text-sm bg-surface border rounded-md
          text-white placeholder:text-muted/60
          focus:outline-none focus:ring-1 transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error
            ? 'border-danger   focus:border-danger   focus:ring-danger/30'
            : 'border-border   focus:border-gold/50  focus:ring-gold/20'
          }
          ${className}
        `}
        {...props}
      />
      {error  && <p className="text-xs text-danger">{error}</p>}
      {helper && !error && <p className="text-xs text-muted">{helper}</p>}
    </div>
  ),
)
Input.displayName = 'Input'
