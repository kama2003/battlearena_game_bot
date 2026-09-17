import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Set in CI when deploying to a subpath (e.g. GitHub Pages project sites:
  // https://<user>.github.io/<repo>/). Defaults to root for local dev and
  // any host that serves the app from its own domain root.
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@battle/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@battle/types": path.resolve(__dirname, "../../packages/types/src"),
      "@battle/config": path.resolve(__dirname, "../../packages/config/src"),
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
  },
});
