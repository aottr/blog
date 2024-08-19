/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  content: [
    /* relevant files from the blog */
    "../../content/**/*.{html,md}",
    "../../layouts/**/*.html",

/* relevant files from the theme */
    "./layouts/**/*.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['"Nunito"', ...defaultTheme.fontFamily.sans],
      },
    }
  },
  plugins: [],
}

