import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

export default {
  // Server-side render by default
  ssr: true,
  // Use the Vercel preset to apply recommended build/ssr settings for Vercel deployments.
  presets: [vercelPreset()],
} satisfies Config;
