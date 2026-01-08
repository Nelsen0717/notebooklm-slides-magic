/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // FUNRAISE Brand Colors - RAISE DAY 2026 Style
        primary: {
          DEFAULT: '#D4AF37', // Gold
          50: '#FBF7E8',
          100: '#F5ECC8',
          200: '#EBD99A',
          300: '#E0C66D',
          400: '#D4AF37',
          500: '#B8972E',
          600: '#9A7E26',
          700: '#7C651E',
          800: '#5E4C17',
          900: '#40330F',
        },
        dark: {
          DEFAULT: '#0A0A0F',
          50: '#4A4A5A',
          100: '#2A2A3A',
          200: '#1A1A25',
          300: '#0F0F17',
          400: '#0A0A0F',
          500: '#050508',
        },
        surface: {
          DEFAULT: '#121218',
          50: '#1E1E28',
          100: '#181820',
          200: '#141418',
          300: '#101014',
        },
        // Accent colors
        gold: {
          DEFAULT: '#D4AF37',
          light: '#E8D18C',
          dark: '#9A7E26',
        },
        neutral: {
          50: '#F5F5F5',
          100: '#E5E5E5',
          200: '#D4D4D4',
          300: '#A3A3A3',
          400: '#737373',
          500: '#525252',
        },
      },
      fontFamily: {
        sans: ['Noto Sans TC', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.375rem',
        md: '0.5rem',
        lg: '0.625rem',
        xl: '0.75rem',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.25)',
        'medium': '0 4px 16px rgba(0, 0, 0, 0.35)',
        'strong': '0 8px 32px rgba(0, 0, 0, 0.45)',
        'glow': '0 0 20px rgba(212, 175, 55, 0.3)',
        'glow-strong': '0 0 40px rgba(212, 175, 55, 0.5)',
        'inner-gold': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
      },
      backgroundImage: {
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
