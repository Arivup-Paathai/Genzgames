/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",

  content: [
    "./index.html",

    "./src/**/*.{js,ts,jsx,tsx}",

    "./index.{js,ts,jsx,tsx}",
    "./App.{js,ts,jsx,tsx}",

    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {},
  },

  plugins: [],
};