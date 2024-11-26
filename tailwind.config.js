/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./public/index.html",
    "./src/pages/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [require('@tailwindcss/typography')],
}