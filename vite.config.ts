import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const SERVER_ENV_KEYS = [
  'SUPABASE_SECRET_KEY',
  'LINE_SYNC_API_KEY',
  'STORAGE_BUCKET',
  'STORAGE_FOLDER',
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  for (const key of SERVER_ENV_KEYS) {
    if (env[key] && !process.env[key]) {
      process.env[key] = env[key];
    }
  }

  return {
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
    build: {
      sourcemap: false, // Disable sourcemaps in production for smaller bundle size
      rollupOptions: {
        output: {
          sourcemapExcludeSources: true,
        },
      },
    },
  };
});
