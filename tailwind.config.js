/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Aptos", "Segoe UI", "sans-serif"],
        display: ["Bahnschrift", "Aptos Display", "Aptos", "sans-serif"],
      },
      boxShadow: {
        panel: "0 22px 70px rgba(15, 23, 42, 0.10)",
      },
    },
  },
  plugins: [],
};
