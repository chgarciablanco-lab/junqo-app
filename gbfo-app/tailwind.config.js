/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#0f2542",
          800: "#16345c",
          700: "#1c4270",
        },
        gold: {
          600: "#b8860b",
          500: "#c9a24b",
          400: "#d4b96a",
        },
      },
      fontFamily: {
        serif: ["Georgia", "'Times New Roman'", "serif"],
      },
    },
  },
  plugins: [],
};
