/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // O chunk do Phaser passa de 1 MB minificado; é esperado.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Phaser vai para um chunk próprio para não inflar o bundle da UI.
        manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
