/** @type {import('tailwindcss').Config} */
export default {
  content: ['./web/index.html', './web/src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // True black so the OLED panel actually turns pixels off.
        ink: '#000000',
        card: '#0a0d12',
        raised: '#11161f',
        line: '#1e293b',
        hairline: '#151b26',
        ht: {
          amber: '#f59e0b',
          amberdim: '#78350f',
          cyan: '#38bdf8',
          cyandim: '#0c4a6e',
          sage: '#93b48b',
          terracotta: '#b4735a',
          olive: '#6f7a4f',
          lav: '#b9bcd0',
          red: '#ef4444',
        },
      },
      borderRadius: {
        card: '20px',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Inter', 'Helvetica Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
