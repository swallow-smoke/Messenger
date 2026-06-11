import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sidebar: '#1a1d21',
        surface: '#222529',
        accent: '#4a9eff',
      },
    },
  },
  plugins: [],
} satisfies Config;
