import { useEffect, useRef, useState } from 'react'
import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts'
import { useEquityCurve } from '@hooks/usePortfolio'

const PERIODS = [
  { label: '7D',  days: 7   },
  { label: '30D', days: 30  },
  { label: '90D', days: 90  },
  { label: '1Y',  days: 365 },
]

export function EquityCurveChart() {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)
  const seriesRef    = useRef<ISeriesApi<'Area'> | null>(null)
  const [days, setDays] = useState(7)

  const { data: points } = useEquityCurve(days)

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background:  { color: 'transparent' },
        textColor:   '#6b7280',
      },
      grid: {
        vertLines: { color: '#1e2330' },
        horzLines:  { color: '#1e2330' },
      },
      crosshair:   { mode: 1 },
      rightPriceScale: {
        borderColor: '#1e2330',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor:       '#1e2330',
        timeVisible:       true,
        secondsVisible:    false,
      },
      handleScale:  true,
      handleScroll: true,
    })

    const series = chart.addAreaSeries({
      lineColor:        '#00d4aa',
      topColor:         'rgba(0, 212, 170, 0.25)',
      bottomColor:      'rgba(0, 212, 170, 0)',
      lineWidth:        2,
      priceFormat:      { type: 'price', precision: 2, minMove: 0.01 },
    })

    chartRef.current  = chart
    seriesRef.current = series

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [])

  // Update series data when points change
  useEffect(() => {
    if (!seriesRef.current || !points) return

    if (points.length === 0) {
      seriesRef.current.setData([])
      return
    }

    const chartData = points.map((p) => ({
      time:  (new Date(p.snapped_at).getTime() / 1000) as UTCTimestamp,
      value: p.equity,
    }))

    seriesRef.current.setData(chartData)
    chartRef.current?.timeScale().fitContent()
  }, [points])

  const startEquity = points?.[0]?.equity ?? 0
  const endEquity   = points?.[points.length - 1]?.equity ?? 0
  const change      = endEquity - startEquity
  const changePct   = startEquity !== 0 ? (change / startEquity) * 100 : 0
  const positive    = change >= 0

  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white">Equity Curve</h2>
          {points && points.length > 0 && (
            <span className={`text-xs font-mono font-semibold ${positive ? 'text-teal' : 'text-danger'}`}>
              {positive ? '+' : ''}{changePct.toFixed(2)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                days === p.days
                  ? 'bg-teal/20 text-teal font-medium'
                  : 'text-muted hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="h-48 w-full" />
      {points?.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-muted">No equity data yet — check back in a few minutes</p>
        </div>
      )}
    </div>
  )
}
