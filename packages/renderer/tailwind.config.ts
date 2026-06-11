import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        sidebar: 'var(--sidebar-bg)',
        surface: 'var(--surface)',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
      },
    },
  },
  plugins: [],
} satisfies Config;
