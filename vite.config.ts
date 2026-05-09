import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const SERVER_ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLIC_KEY',
  'VITE_SUPABASE_KEY',
  'SUPABASE_URL',
  'SUPABASE_PUBLIC_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_KEY',
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  for (const key of SERVER_ENV_KEYS) {
    if (env[key] && !process.env[key]) {
      process.env[key] = env[key];
    }
  }

  process.env.SUPABASE_URL ??= process.env.VITE_SUPABASE_URL;
  process.env.SUPABASE_PUBLIC_KEY ??= process.env.VITE_SUPABASE_PUBLIC_KEY ?? process.env.VITE_SUPABASE_KEY;

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
  };
});
