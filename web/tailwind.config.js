/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#0a0a0f',
        surface: '#0f0f16',
        panel: '#121218',
        elevated: '#1a1a24',
        line: '#252530',
        bright: '#3a3a48',
        cyan: '#00d9ff',
        violet: '#c4a7ff',
        danger: '#ff3864',
        success: '#5fff87',
        ink: '#f5f7ff',
        mist: '#8f90a6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(0, 217, 255, 0.22), 0 0 32px rgba(0, 217, 255, 0.08)',
        violet: '0 0 0 1px rgba(196, 167, 255, 0.18), 0 24px 48px rgba(17, 17, 28, 0.65)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(58,58,72,0.24) 1px, transparent 1px), linear-gradient(90deg, rgba(58,58,72,0.24) 1px, transparent 1px)',
      },
      keyframes: {
        pulseLine: {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '1' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-line': 'pulseLine 1.6s ease-in-out infinite',
        rise: 'rise 240ms ease-out',
      },
    },
  },
  plugins: [],
}
