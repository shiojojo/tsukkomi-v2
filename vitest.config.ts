/// <reference types="vitest" />
import { defineConfig } from 'vite'
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from 'path'

export default defineConfig({
  plugins: [tailwindcss(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, './app'),
    },
  },
})