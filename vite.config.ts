import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  if (env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY) {
    process.env.SUPABASE_SECRET_KEY = env.SUPABASE_SECRET_KEY;
  }
  if (env.LINE_SYNC_API_KEY && !process.env.LINE_SYNC_API_KEY) {
    process.env.LINE_SYNC_API_KEY = env.LINE_SYNC_API_KEY;
  }
  if (env.STORAGE_BUCKET && !process.env.STORAGE_BUCKET) {
    process.env.STORAGE_BUCKET = env.STORAGE_BUCKET;
  }
  if (env.STORAGE_FOLDER && !process.env.STORAGE_FOLDER) {
    process.env.STORAGE_FOLDER = env.STORAGE_FOLDER;
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
    },
  };
});
