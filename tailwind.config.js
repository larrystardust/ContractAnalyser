/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // This line enables dark mode based on the presence of the 'dark' class
  theme: {
    extend: {
      colors: {
        // Add a custom blue color for the logo
        BlueLogo: '#0370ff',
      },
    },
  },
  plugins: [],
};