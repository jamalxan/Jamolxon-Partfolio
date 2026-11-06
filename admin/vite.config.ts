/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Haqiqiy backend bilan lokal ishlash: `VITE_PROXY_TARGET=http://localhost:8000 npm run dev`
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:8000'
  return {
    base: '/',
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5174,
      proxy: mode === 'mock' ? undefined : { '/api': { target: proxyTarget, changeOrigin: true } },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 900,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      restoreMocks: true,
      testTimeout: 60_000,
      hookTimeout: 300_000,
      // Sekin mashinalarda worker'lar bir-birini bo'g'ib qo'ymasin
      maxWorkers: 2,
      minWorkers: 1,
    },
  }
})
