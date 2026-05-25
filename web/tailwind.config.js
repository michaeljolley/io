/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ── NEW design tokens ── */
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

        /* ── Compatibility aliases (old tokens) ── */
        surface: {
          0: '#0a0a0f',
          1: '#0f0f16',
          2: '#121218',
          3: '#1a1a24',
        },
        edge: {
          DEFAULT: '#252530',
          bright: '#3a3a48',
        },
        accent: {
          DEFAULT: '#00d9ff',
          dim: '#0080a0',
          glow: '#00d9ff',
        },
        txt: {
          primary: '#ffffff',
          secondary: '#e8e8ed',
          muted: '#8a8a99',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1rem',
      },
      boxShadow: {
        glow: '0 0 20px -4px rgba(0, 217, 255, 0.15)',
        'glow-sm': '0 0 10px -2px rgba(0, 217, 255, 0.1)',
        card: '0 1px 3px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(37, 37, 48, 0.5)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(58, 58, 72, 0.7)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
  darkMode: 'selector',
}
