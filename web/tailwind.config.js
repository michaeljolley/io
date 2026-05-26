/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background-rgb) / <alpha-value>)',
        foreground: 'rgb(var(--foreground-rgb) / <alpha-value>)',
        card: 'rgb(var(--card-rgb) / <alpha-value>)',
        popover: 'rgb(var(--popover-rgb) / <alpha-value>)',
        primary: 'rgb(var(--primary-rgb) / <alpha-value>)',
        secondary: 'rgb(var(--secondary-rgb) / <alpha-value>)',
        muted: 'rgb(var(--muted-rgb) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--muted-foreground-rgb) / <alpha-value>)',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        'accent-foreground': 'rgb(var(--accent-foreground-rgb) / <alpha-value>)',
        destructive: 'rgb(var(--destructive-rgb) / <alpha-value>)',
        border: 'rgb(var(--border-rgb) / <alpha-value>)',
        sidebar: 'rgb(var(--sidebar-rgb) / <alpha-value>)',
        'status-idle': 'rgb(var(--status-idle-rgb) / <alpha-value>)',
        'status-working': 'rgb(var(--status-working-rgb) / <alpha-value>)',
        'status-error': 'rgb(var(--status-error-rgb) / <alpha-value>)',
        'status-success': 'rgb(var(--status-success-rgb) / <alpha-value>)',
        'universe-ateam': 'rgb(var(--universe-ateam-rgb) / <alpha-value>)',
        'universe-thundercats': 'rgb(var(--universe-thundercats-rgb) / <alpha-value>)',
        'universe-gijoe': 'rgb(var(--universe-gijoe-rgb) / <alpha-value>)',
        'universe-ghostbusters': 'rgb(var(--universe-ghostbusters-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        cyan: 'var(--glow-cyan)',
        error: 'var(--glow-error)',
        success: 'var(--glow-success)',
      },
      keyframes: {
        'status-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.4' },
          '50%': { transform: 'scale(1.65)', opacity: '0' },
        },
        'status-blink': {
          '0%, 49%, 100%': { opacity: '1' },
          '50%, 75%': { opacity: '0.35' },
        },
      },
      animation: {
        'status-pulse': 'status-pulse 2s ease-in-out infinite',
        'status-blink': 'status-blink 1s linear infinite',
      },
    },
  },
  plugins: [],
}
