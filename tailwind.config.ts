import type { Config } from 'tailwindcss';

// Tokens are declared as CSS variables in app/globals.css.
// Tailwind consumes them via `rgb(var(--token) / <alpha-value>)` when needed;
// for now we expose hex values directly via `var(--token)` since opacity-on-colors
// is not required in E1. Revisit when a use-case demands per-utility opacity.

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-dim': 'var(--text-dim)',
        accent: 'var(--accent)',
        'accent-dim': 'var(--accent-dim)',
        positive: 'var(--positive)',
        'positive-dim': 'var(--positive-dim)',
        negative: 'var(--negative)',
        'chart-neutral': 'var(--chart-neutral)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '1.4' }],
        xs: ['12px', { lineHeight: '1.5' }],
        sm: ['13px', { lineHeight: '1.6' }],
        base: ['15px', { lineHeight: '1.7' }],
        lg: ['18px', { lineHeight: '1.6' }],
        xl: ['22px', { lineHeight: '1.4' }],
        '2xl': ['30px', { lineHeight: '1.2' }],
        '3xl': ['36px', { lineHeight: '1.1' }],
        display: ['56px', { lineHeight: '1.05' }],
        hero: ['clamp(3rem, 8vw, 5.5rem)', { lineHeight: '1.02' }],
      },
      letterSpacing: {
        tightest: '-0.025em',
        tighter: '-0.015em',
        wide: '+0.005em',
        widest: '+0.14em',
      },
      spacing: {
        0.5: '2px',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        6: '24px',
        8: '32px',
        12: '48px',
        16: '64px',
        24: '96px',
        30: '120px',
      },
      borderRadius: {
        sm: '2px',
        md: '4px',
        pill: '9999px',
      },
      maxWidth: {
        content: '1240px',
      },
    },
  },
  plugins: [],
};

export default config;
