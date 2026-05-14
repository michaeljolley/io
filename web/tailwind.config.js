/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* Layered surfaces — deep blue-black base */
        surface: {
          0: '#060a13',
          1: '#0c1220',
          2: '#131b2e',
          3: '#1a2540',
        },
        /* Borders with blue undertone */
        edge: {
          DEFAULT: '#1e2d4a',
          bright: '#2a3f65',
        },
        /* Cyan accent — terminal-cursor glow */
        accent: {
          DEFAULT: '#22d3ee',
          dim: '#0e7490',
          glow: '#06b6d4',
        },
        /* Text hierarchy */
        txt: {
          primary: '#e2e8f0',
          secondary: '#8b9dc3',
          muted: '#4a5f88',
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
        glow: '0 0 20px -4px rgba(34, 211, 238, 0.15)',
        'glow-sm': '0 0 10px -2px rgba(34, 211, 238, 0.1)',
        card: '0 1px 3px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(30, 45, 74, 0.5)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(42, 63, 101, 0.7)',
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
