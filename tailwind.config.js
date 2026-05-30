/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        soma: {
          50: '#f1f7f6',
          100: '#deedeb',
          200: '#c0dcda',
          300: '#8bbfbb',
          400: '#4e9b98',
          500: '#197c79',
          600: '#116663',
          700: '#0b5353',
          800: '#073f43',
          900: '#0a2332',
        },
        sun: '#c9a76a',
        rose: '#ba7c72',
        mist: '#f8faf9',
      },
      fontFamily: {
        sans: ['Inter', 'Avenir Next', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 12px 34px rgba(10, 35, 50, 0.06)',
      },
    },
  },
  plugins: [],
}
