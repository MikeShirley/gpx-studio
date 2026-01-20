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
        // Custom colors for GPX elements
        track: {
          DEFAULT: '#E53935',
          hover: '#EF5350',
        },
        route: {
          DEFAULT: '#1E88E5',
          hover: '#42A5F5',
        },
        waypoint: {
          DEFAULT: '#43A047',
          hover: '#66BB6A',
        },
        selection: {
          DEFAULT: '#FB8C00',
          hover: '#FFA726',
        },
      },
    },
  },
  plugins: [],
};
