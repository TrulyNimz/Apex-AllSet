/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void:    'var(--color-void)',
        deep:    'var(--color-deep)',
        surface: 'var(--color-surface)',
        panel:   'var(--color-panel)',
        border:  'var(--color-border)',
        muted:   'var(--color-muted)',
        gold:    'var(--color-gold)',
        teal:    'var(--color-teal)',
        danger:  'var(--color-danger)',
        warning: 'var(--color-warning)',
      },
      fontFamily: {
        sans:    ['DM Sans',          'system-ui', 'sans-serif'],
        mono:    ['DM Mono',          'monospace'],
        serif:   ['Instrument Serif', 'Georgia',   'serif'],
        display: ['Bebas Neue',       'sans-serif'],
      },
      keyframes: {
        'tick-up': {
          '0%':   { backgroundColor: 'rgb(0 212 170 / 0.3)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'tick-down': {
          '0%':   { backgroundColor: 'rgb(255 71 87 / 0.3)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        'tick-up':   'tick-up 0.5s ease-out',
        'tick-down': 'tick-down 0.5s ease-out',
      },
    },
  },
  plugins: [],
}
