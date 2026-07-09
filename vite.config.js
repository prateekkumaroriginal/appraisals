import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("recharts")) return "charts";
          if (id.includes("lucide-react")) return "icons";
          return "vendor";
        },
      },
    },
  },
  server: {
    proxy: {
      "/locomo": {
        target: "https://apiv6.locomo.io",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/locomo/, ""),
      },
    },
  },
});
