/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        buildnavy: '#1b2a47',
        buildorange: '#ff6b35',
      }
    },
  },
  plugins: [],
}
