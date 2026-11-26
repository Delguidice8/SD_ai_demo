/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './terminal.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        t: {
          bg: 'rgb(var(--t-bg) / <alpha-value>)',
          panel: 'rgb(var(--t-panel) / <alpha-value>)',
          elev: 'rgb(var(--t-elev) / <alpha-value>)',
          hover: 'rgb(var(--t-hover) / <alpha-value>)',
          border: 'rgb(var(--t-border) / <alpha-value>)',
          text: 'rgb(var(--t-text) / <alpha-value>)',
          muted: 'rgb(var(--t-muted) / <alpha-value>)',
          faint: 'rgb(var(--t-faint) / <alpha-value>)',
          accent: 'rgb(var(--t-accent) / <alpha-value>)',
          up: 'rgb(var(--t-up) / <alpha-value>)',
          down: 'rgb(var(--t-down) / <alpha-value>)',
        },
      },
      animation: {
        'gradient': 'gradient 15s ease infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          },
        },
      },
    },
  },
  plugins: [],
};
