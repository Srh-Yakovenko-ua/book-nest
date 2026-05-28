import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, loadEnv } from "vite";
import checker from "vite-plugin-checker";
import { compression } from "vite-plugin-compression2";
import svgr from "vite-plugin-svgr";

export default defineConfig(({ command, mode }) => {
  const isProduction = command === "build";
  const isDev = command === "serve";
  const env = loadEnv(mode, process.cwd(), "");

  return {
    build: {
      assetsInlineLimit: 4096,
      chunkSizeWarningLimit: 600,
      cssCodeSplit: true,
      cssMinify: "esbuild",
      emptyOutDir: true,
      minify: "esbuild",
      modulePreload: {
        polyfill: false,
      },
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          assetFileNames: "assets/[name]-[hash][extname]",
          chunkFileNames: "assets/[name]-[hash].js",
          entryFileNames: "assets/[name]-[hash].js",
          manualChunks(id) {
            if (id.includes("recharts")) return "chart-vendor";
            if (id.includes("date-fns") || id.includes("react-day-picker")) return "date-vendor";
            if (
              id.includes("react-hook-form") ||
              id.includes("@hookform/resolvers") ||
              id.includes("zod")
            )
              return "form-vendor";
            if (
              id.includes("@tanstack/react-query-persist-client") ||
              id.includes("@tanstack/react-query")
            )
              return "query-vendor";
            if (id.includes("@floating-ui")) return "ui-vendor";
            if (id.includes("/react-dom") || id.includes("/react-router") || id.includes("/react/"))
              return "react-vendor";
            if (id.includes("@tanstack/react-table") || id.includes("@tanstack/react-virtual"))
              return "table-vendor";
            if (
              id.includes("radix-ui") ||
              id.includes("lucide-react") ||
              id.includes("sonner") ||
              id.includes("cmdk") ||
              id.includes("vaul")
            )
              return "ui-vendor";
            return undefined;
          },
        },
      },
      sourcemap: true,
      target: "es2022",
    },

    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
      __DEV__: JSON.stringify(isDev),
      __PROD__: JSON.stringify(isProduction),
    },

    esbuild: {
      drop: isProduction ? ["console", "debugger"] : [],
      legalComments: "none",
      pure: isProduction ? ["console.log", "console.info", "console.debug"] : [],
    },

    optimizeDeps: {
      holdUntilCrawlEnd: false,
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react-router",
        "@tanstack/react-query",
        "lucide-react",
        "sonner",
        "react-hook-form",
        "zod",
        "clsx",
        "tailwind-merge",
      ],
    },

    plugins: [
      react(),
      tailwindcss(),
      svgr({
        include: "**/*.svg?react",
        svgrOptions: {
          exportType: "default",
          ref: true,
          svgo: true,
          titleProp: true,
        },
      }),
      checker({
        enableBuild: false,
        overlay: { initialIsOpen: false, position: "br" },
        typescript: true,
      }),
      isProduction && compression({ algorithms: ["gzip", "brotliCompress"] }),
      isProduction &&
        visualizer({
          brotliSize: true,
          filename: "dist/stats.html",
          gzipSize: true,
          open: false,
          template: "treemap",
        }),
    ],

    preview: {
      cors: true,
      host: true,
      port: 4173,
      strictPort: true,
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      conditions: ["source"],
    },

    server: {
      cors: true,
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
      hmr: {
        overlay: true,
      },
      host: true,
      open: false,
      port: 5173,
      proxy: {
        "/api": {
          changeOrigin: true,
          target: env.VITE_API_BASE_URL || "http://localhost:4000",
        },
      },
      strictPort: true,
      warmup: {
        clientFiles: [
          "./src/main.tsx",
          "./src/App.tsx",
          "./src/routes/layouts/app-shell.tsx",
          "./src/features/health/pages/health-page.tsx",
        ],
      },
    },
  };
});
