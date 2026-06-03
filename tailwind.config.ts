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
      fontSize: {
        // Used widely for micro eyebrow/stat labels — was undefined (no-op) before.
        '2xs': ['0.625rem', { lineHeight: '0.9rem' }],
      },
      colors: {
        // Sporteo brand — orange #F35703 + navy #1D4672 (sampled from the deck).
        // Override the default `orange` scale so every *-orange-* utility across
        // the app renders on-brand (centralised recolour, no per-file edits).
        orange: {
          50:  '#FEF0E7',
          100: '#FDDDCB',
          200: '#FBC1A0',
          300: '#F89B6A',
          400: '#F5733A',
          500: '#F35703',
          600: '#D44A02',
          700: '#B03D04',
          800: '#8A300A',
          900: '#702A0C',
          950: '#3D1604',
        },
        navy: {
          50:  '#EAF0F6',
          100: '#D2DEEB',
          200: '#A6BDD7',
          300: '#6E8FB6',
          400: '#3E6796',
          500: '#1D4672',
          600: '#163A5E',
          700: '#142F4B',
          800: '#11263B',
          900: '#0E1E2E',
        },
        brand: {
          orange: '#F35703',
          'orange-light': '#FEF0E7',
          'orange-mid': '#FDDDCB',
          blue: '#1D4672',
          'blue-light': '#EAF0F6',
          'blue-mid': '#D2DEEB',
          navy: '#1D4672',
          cream: '#FBF3EC',
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
