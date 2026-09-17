import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
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
