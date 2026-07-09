import { type HTMLAttributes } from 'react'

type Tone = 'teal' | 'danger' | 'gold' | 'muted'

const tones: Record<Tone, string> = {
  teal: 'bg-teal/15 text-teal',
  danger: 'bg-danger/15 text-danger',
  gold: 'bg-gold/15 text-gold',
  muted: 'bg-panel text-muted',
}

export function Badge({
  tone = 'muted',
  className = '',
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}
      {...rest}
    />
  )
}
