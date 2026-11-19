import { brand } from './src/config/brand.js'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        soma: {
          50: '#f2f8fe',
          100: '#e3f0fc',
          200: brand.colors.softBlue,
          300: brand.colors.lightBlue,
          400: '#388bd1',
          500: brand.colors.primary,
          600: '#1161b5',
          700: '#184a7c',
          800: '#123e6b',
          900: brand.colors.navy,
        },
        mist: '#f7faff',
      },
      fontFamily: {
        sans: ['Inter', 'Avenir Next', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 10px 30px rgba(17, 98, 181, 0.07)',
      },
    },
  },
  plugins: [],
}
