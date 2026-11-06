import type { Config } from 'tailwindcss'

const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      colors: {
        // Sayt palitrasi (frontend/assets/css/styles.css :root)
        maroon: { DEFAULT: '#250104', 2: '#3a0509', card: '#330408' },
        red: { DEFAULT: '#D71A06', 2: '#b51404' },
        yellow: { DEFAULT: '#CDF73D', 2: '#e6ff7a' },
        cream: '#FFF1DC',
        background: rgb('--background'),
        foreground: rgb('--foreground'),
        card: { DEFAULT: rgb('--card'), foreground: rgb('--foreground') },
        popover: { DEFAULT: rgb('--popover'), foreground: rgb('--foreground') },
        primary: { DEFAULT: rgb('--primary'), foreground: rgb('--primary-foreground') },
        secondary: { DEFAULT: rgb('--secondary'), foreground: rgb('--foreground') },
        muted: { DEFAULT: rgb('--muted'), foreground: rgb('--muted-foreground') },
        accent: { DEFAULT: rgb('--accent'), foreground: rgb('--foreground') },
        destructive: { DEFAULT: rgb('--destructive'), foreground: rgb('--foreground') },
        border: rgb('--border'),
        input: rgb('--border'),
        ring: rgb('--primary'),
      },
      fontFamily: {
        display: ['Unbounded', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { lg: '18px', md: '12px', sm: '8px' },
    },
  },
  plugins: [],
} satisfies Config
