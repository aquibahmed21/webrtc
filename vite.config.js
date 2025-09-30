import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true
  },
  base: "/webrtc",
  test: {
    environment: 'jsdom'
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html',
        callui: './callui.html',
        signin: './signin.html'
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});