/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      borderRadius: {
        'DEFAULT': '6px',
        'sm': '5px',
        'md': '8px',
        'lg': '11px',
        'xl': '14px',
        '2xl': '18px',
      },
    },
  },
  plugins: [],
}
