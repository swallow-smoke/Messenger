import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    build: {
      target: 'node20',
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/main.ts'),
        },
        output: {
          entryFileNames: '[name].js',
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    build: {
      target: 'node20',
      outDir: 'dist',
      emptyOutDir: false,
      rollupOptions: {
        input: {
          preload: resolve(__dirname, 'src/preload.ts'),
        },
        output: {
          entryFileNames: '[name].js',
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
});
