/// <reference types="vitest" />
import { defineConfig } from 'vite'
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from 'path'

export default defineConfig({
  plugins: [tailwindcss(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    exclude: ['e2e/**'],
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, './app'),
    },
  },
})