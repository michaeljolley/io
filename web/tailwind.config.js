/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          app: '#0a0a0f',
          surface: '#0f0f16',
          card: '#121218',
          elevated: '#1a1a24',
        },
        border: {
          DEFAULT: '#252530',
          bright: '#3a3a48',
        },
        'accent-cyan': '#00d9ff',
        'accent-purple': '#c4a7ff',
        'accent-red': '#ff3864',
        'accent-green': '#5fff87',
        text: {
          DEFAULT: '#ffffff',
          secondary: '#e8e8ed',
          muted: '#8a8a99',
        },
        surface: { 0: '#0a0a0f', 1: '#0f0f16', 2: '#121218', 3: '#1a1a24' },
        edge: { DEFAULT: '#252530', bright: '#3a3a48' },
        accent: { DEFAULT: '#00d9ff', dim: '#0080a0', glow: '#00d9ff' },
        txt: { primary: '#ffffff', secondary: '#e8e8ed', muted: '#8a8a99' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Consolas', 'monospace'],
      },
      animation: { 'fade-in': 'fadeIn 0.15s ease-out' },
      keyframes: { fadeIn: { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } } },
    },
  },
  plugins: [],
}
