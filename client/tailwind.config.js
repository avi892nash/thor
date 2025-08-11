/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        'inter': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
        'mono': ['source-code-pro', 'Menlo', 'Monaco', 'Consolas', 'Courier New', 'monospace'],
      },
      animation: {
        'slideUp': 'slideUp 0.6s ease-out',
        'fadeIn': 'fadeIn 0.8s ease-out',
        'slideDown': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    function({ addBase }) {
      addBase({
        'body': {
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          backgroundColor: '#0a0a0a',
          color: '#ffffff',
          lineHeight: '1.6',
        },
        'code': {
          fontFamily: 'source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace',
        },
        '::-webkit-scrollbar': {
          width: '8px',
        },
        '::-webkit-scrollbar-track': {
          backgroundColor: '#1a1a1a',
          borderRadius: '4px',
        },
        '::-webkit-scrollbar-thumb': {
          backgroundColor: '#333',
          borderRadius: '4px',
        },
        '::-webkit-scrollbar-thumb:hover': {
          backgroundColor: '#555',
        },
      })
    }
  ],
} 