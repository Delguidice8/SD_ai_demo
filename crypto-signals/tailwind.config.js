/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#07090d', 900: '#0b0e14', 800: '#11151d', 700: '#1a1f2a', 600: '#262c3a' },
        lime: { signal: '#c6f432' },
        bull: '#22d39a',
        bear: '#ff5d6c',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        draw: { from: { strokeDashoffset: '2000' }, to: { strokeDashoffset: '0' } },
        pop: { '0%': { transform: 'scale(0)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
      },
      animation: {
        marquee: 'marquee 40s linear infinite',
        draw: 'draw 2.4s ease-out forwards',
        pop: 'pop .4s ease-out both',
      },
    },
  },
  plugins: [],
};
