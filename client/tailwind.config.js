/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Walnut browns and brass accents for a warm furniture-workshop feel.
        walnut: {
          50: '#faf6f2',
          100: '#f2e9df',
          200: '#e4d2bd',
          300: '#d2b393',
          400: '#bd8f68',
          500: '#a8734c',
          600: '#8f5c3c',
          700: '#744832',
          800: '#5c3a2c',
          900: '#3f2a21',
          950: '#241611',
        },
        brass: {
          50: '#fcf8ec',
          100: '#f6ecc9',
          200: '#edd78f',
          300: '#e3bd55',
          400: '#d9a531',
          500: '#c48a22',
          600: '#a66a1b',
          700: '#854e1a',
          800: '#6d3f1b',
          900: '#5c351b',
        },
        sage: {
          50: '#f4f7f4',
          100: '#e3ebe3',
          500: '#5f7f63',
          600: '#4b674f',
          700: '#3d5341',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(36, 22, 17, 0.04), 0 1px 3px rgba(36, 22, 17, 0.06)',
        lift: '0 10px 30px -10px rgba(36, 22, 17, 0.25)',
      },
    },
  },
  plugins: [],
};
