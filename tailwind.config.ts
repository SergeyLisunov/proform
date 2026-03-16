import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['"Bebas Neue"', 'sans-serif'],
      },
      colors: {
        brand: {
          orange: '#F97316',
          'orange-light': '#FFF7ED',
          'orange-mid': '#FFEDD5',
          blue: '#2563EB',
          'blue-light': '#EFF6FF',
          'blue-mid': '#DBEAFE',
        },
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(-16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out both',
        'slide-in': 'slide-in 0.25s ease-out both',
      },
    },
  },
  plugins: [],
}

export default config
