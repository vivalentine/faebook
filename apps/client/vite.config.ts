import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devHost = env.VITE_DEV_HOSTNAME || "vi-pc.local";
  const devPort = Number(env.VITE_DEV_PORT || 5173);
  const previewPort = Number(env.VITE_PREVIEW_PORT || 4173);

  return {
    plugins: [react()],
    server: {
      host: true,
      port: devPort,
      strictPort: true,
      allowedHosts: [devHost, "localhost"],
      hmr: {
        host: devHost,
      },
      proxy: {
        "/api": "http://127.0.0.1:3001",
        "/uploads": "http://127.0.0.1:3001",
      },
    },
    preview: {
      host: true,
      port: previewPort,
      strictPort: true,
      allowedHosts: [devHost, "localhost"],
    },
    build: {
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return undefined;
            }

            if (id.includes("openseadragon")) {
              return "maps-vendor";
            }

            if (id.includes("react-router") || id.includes("react-router-dom")) {
              return "router-vendor";
            }

            if (id.includes("react-dom") || id.includes("react")) {
              return "react-vendor";
            }

            if (id.includes("@xyflow/react")) {
              return "board-vendor";
            }

            return undefined;
          },
        },
      },
    },
  };
});
