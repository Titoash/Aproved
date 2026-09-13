/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Build de arquivo único para playtests (artifact): um só chunk ESM, sem divisão do Phaser,
 * caminhos relativos. `scripts/empacotar.mjs` embute JS, CSS e fontes num único HTML.
 */
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist-artifact",
    emptyOutDir: true,
    chunkSizeWarningLimit: 3000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: "kardashev.js",
        assetFileNames: "kardashev.[ext]",
      },
    },
  },
});
