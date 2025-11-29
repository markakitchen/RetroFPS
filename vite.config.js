import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // <--- This forces the app to look for files relative to the current folder
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  },
  server: {
    port: 3000,
    open: true
  }
});