/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'midnight-ink': '#091135',
        'electric-blue': '#0f77ff',
        'cobalt-surface': '#127ee3',
        'clearbit-slate': '#36394a',
        'frost-border': '#e1e9f0',
        'mist': '#b1bbcd',
        'graphite': '#000000',
        'paper': '#ffffff',
        'lavender-wash': '#f5f3ff',
      },
      fontFamily: {
        sans: ['InterVar', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      letterSpacing: {
        'caption': '0.004em',
        'body': '0.008em',
        'heading-sm': '0.016em',
        'heading': '0.018em',
      },
      borderRadius: {
        'DEFAULT': '8px',
        'sm': '4px',
        'md': '8px',
        'lg': '8px',
        'xl': '12px',
        '2xl': '16px',
        'card': '12px',
        'btn': '8px',
        'input': '8px',
        'tag': '9999px',
      },
    },
  },
  plugins: [],
}
