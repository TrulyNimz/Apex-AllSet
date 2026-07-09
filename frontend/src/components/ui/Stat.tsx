import { Card } from './Card'

type Tone = 'default' | 'teal' | 'danger'

export function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: Tone }) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'teal' ? 'text-teal' : 'text-white'
  return (
    <Card className="p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`tnum mt-1 text-lg font-semibold ${color}`}>{value}</div>
    </Card>
  )
}
