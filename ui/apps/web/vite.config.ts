import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";

const port = Number(process.env.PORT ?? 5733);

function resolveApiProxyTarget(): string {
  const wsUrl = (process.env.VITE_WS_URL ?? "").trim();
  if (wsUrl.length > 0) {
    const httpUrl = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
    try {
      return new URL(httpUrl).origin;
    } catch {
      return httpUrl;
    }
  }

  const host = (process.env.T3CODE_HOST ?? "127.0.0.1").trim() || "127.0.0.1";
  const serverPort = Number(process.env.T3CODE_PORT ?? 3773);
  return `http://${host}:${Number.isFinite(serverPort) ? serverPort : 3773}`;
}

export default defineConfig({
  plugins: [
    tanstackRouter(),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", { target: "19" }]],
      },
    }),
    tailwindcss(),
  ],
  optimizeDeps: {
    include: ["@pierre/diffs", "@pierre/diffs/react", "@pierre/diffs/worker/worker.js"],
  },
  define: {
    // In dev mode, tell the web app where the WebSocket server lives
    "import.meta.env.VITE_WS_URL": JSON.stringify(process.env.VITE_WS_URL ?? ""),
  },
  experimental: {
    enableNativePlugin: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port,
    strictPort: true,
    proxy: {
      "/api": {
        target: resolveApiProxyTarget(),
        changeOrigin: true,
      },
    },
    hmr: {
      // Explicit config so Vite's HMR WebSocket connects reliably
      // inside Electron's BrowserWindow. Vite 8 uses console.debug for
      // connection logs — enable "Verbose" in DevTools to see them.
      protocol: "ws",
      host: "localhost",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
