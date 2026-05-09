import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    watch: {
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        '**/build/**',
        '**/coverage/**',
        '**/dist/**',
        '**/playwright-report/**',
        '**/test-results/**',
      ],
    },
  },
  optimizeDeps: {
    exclude: ["sharp"],
  },
  build: {
    sourcemap: false, // Disable sourcemaps in production for smaller bundle size
    rollupOptions: {
      output: {
        sourcemapExcludeSources: true,
      },
    },
  },
});
