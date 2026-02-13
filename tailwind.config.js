/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#4f46e5", 
        "background-dark": "#0f111a", 
      },
      fontFamily: { "display": ["Inter", "sans-serif"] },
    },
  },
  plugins: [],
}