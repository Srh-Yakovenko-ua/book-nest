# Vite

## What it is

[Vite](https://vitejs.dev) is the build tool powering the FE. It provides:

- A **dev server** that serves source files directly via native ES modules (near-instant cold start, no bundling)
- **Hot Module Replacement** that preserves component state on edit
- A **production build** that uses Rollup with aggressive tree-shaking and code splitting
- A plugin ecosystem compatible with Rollup plugins

## Why we have it

Vite is the modern standard for non-Next.js React apps in 2026. It's:

- Faster than webpack for dev (no bundling step until you request a file)
- Lighter than Next.js for pure SPAs (no server-side concerns we don't need)
- Fully compatible with our tools (Tailwind v4 plugin, SWC plugin, Vitest, svgr)
- Production-grade — used by Vercel, Shopify, Replit, Cloudflare

## Config — `apps/web/vite.config.ts`

The config is a **function** (not an object) so it can branch on `command` (`serve` vs `build`) and `mode`:

```ts
export default defineConfig(({ command, mode }) => {
  const isProduction = command === "build";
  const isDev = command === "serve";
  const env = loadEnv(mode, process.cwd(), "");
  return {
    /* ... */
  };
});
```

### Plugins (in order — order matters)

| Plugin                     | Purpose                                                                    |
| -------------------------- | -------------------------------------------------------------------------- |
| `@vitejs/plugin-react-swc` | React JSX transform + Fast Refresh via SWC (Rust — ~20× faster than Babel) |
| `@tailwindcss/vite`        | Tailwind v4 integration                                                    |
| `vite-plugin-svgr`         | Import SVG as React component: `import Icon from "./i.svg?react"`          |
| `vite-plugin-checker`      | TypeScript errors shown as a browser overlay during dev                    |
| `vite-plugin-compression2` | gzip + brotli compression on build (only in `isProduction`)                |
| `rollup-plugin-visualizer` | Generates `dist/stats.html` bundle treemap (only in `isProduction`)        |

### `define` — global constants

```ts
define: {
  __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  __DEV__:  JSON.stringify(isDev),
  __PROD__: JSON.stringify(isProduction),
}
```

These are statically replaced at build time. Use them like:

```ts
if (__DEV__) {
  // removed from production bundle via dead-code elimination
}
```

Type declarations live in `apps/web/src/env.d.ts` under `declare global`.

### `esbuild` — production minification

```ts
esbuild: {
  drop: isProduction ? ["console", "debugger"] : [],
  pure: isProduction ? ["console.log", "console.info", "console.debug"] : [],
  legalComments: "none",
}
```

- `drop: ["console", "debugger"]` — removes `console.*` and `debugger` statements from prod
- `pure` — marks these as pure function calls so they can be dead-code-eliminated even if their results are unused
- `legalComments: "none"` — strips `/*! ... */` banners from minified output

### `server` — dev server

| Option               | Value                                                      | Purpose                                                                               |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `port`               | `5173`                                                     | Default Vite port                                                                     |
| `strictPort`         | `true`                                                     | Fail loudly if port is taken instead of silently using 5174                           |
| `host`               | `true`                                                     | Listen on `0.0.0.0` so the dev server is accessible over LAN                          |
| `cors`               | `true`                                                     | CORS headers for dev                                                                  |
| `headers`            | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` | Security headers parity with prod                                                     |
| `hmr.overlay`        | `true`                                                     | Show HMR errors as overlay                                                            |
| `warmup.clientFiles` | main.tsx, App.tsx, shell, health page                      | Pre-transform critical files on startup for faster initial load                       |
| `proxy["/api"]`      | `http://localhost:4000`                                    | Forward `/api/*` to the Express backend. Target comes from `VITE_API_BASE_URL` if set |

### `preview` — prod build preview

Runs with `pnpm preview`, same port rules as `server`:

| Option       | Value  |
| ------------ | ------ |
| `port`       | `4173` |
| `strictPort` | `true` |
| `host`       | `true` |
| `cors`       | `true` |

### `build` — production output

| Option                                          | Value       | Purpose                                                                  |
| ----------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `target`                                        | `"es2022"`  | Modern browsers only, no polyfills                                       |
| `sourcemap`                                     | `true`      | Source maps for prod error tracking                                      |
| `cssCodeSplit`                                  | `true`      | Each chunk gets its own CSS file                                         |
| `cssMinify`                                     | `"esbuild"` | esbuild minification for CSS                                             |
| `minify`                                        | `"esbuild"` | esbuild minification for JS (20-40× faster than terser, ~2% larger)      |
| `assetsInlineLimit`                             | `4096`      | Assets smaller than 4 KB are inlined as base64                           |
| `chunkSizeWarningLimit`                         | `600`       | Warn when a chunk is larger than 600 KB                                  |
| `reportCompressedSize`                          | `false`     | Skip gzip size calc in build logs (we use visualizer instead)            |
| `modulePreload.polyfill`                        | `false`     | Skip modulepreload polyfill — ES2022 target supports it natively         |
| `rollupOptions.output.experimentalMinChunkSize` | `10_000`    | Merge chunks smaller than 10 KB into larger ones to reduce HTTP overhead |
| `rollupOptions.output.manualChunks`             | see below   | Split vendor libraries into dedicated chunks for caching                 |

### `manualChunks` strategy

```ts
manualChunks: {
  "react-vendor":   ["react", "react-dom", "react-router"],
  "query-vendor":   ["@tanstack/react-query", "@tanstack/react-query-persist-client"],
  "table-vendor":   ["@tanstack/react-table", "@tanstack/react-virtual"],
  "form-vendor":    ["react-hook-form", "@hookform/resolvers", "zod"],
  "chart-vendor":   ["recharts"],
  "ui-vendor":      ["radix-ui", "lucide-react", "sonner", "cmdk", "vaul"],
  "date-vendor":    ["date-fns", "react-day-picker"],
}
```

Benefits:

- **Browser cache** — `react-vendor-abc123.js` is a stable chunk that's cached across deploys; only the app code chunk's hash changes
- **Parallel downloads** — multiple small vendor chunks load in parallel
- **Tree-shake awareness** — Vite only includes code from a vendor chunk that's actually imported (chart-vendor stays empty until something imports recharts)

### `optimizeDeps` — pre-bundling

```ts
optimizeDeps: {
  holdUntilCrawlEnd: false,
  include: ["react", "react-dom", "react-dom/client", "react-router", "@tanstack/react-query", ...],
}
```

- `include` forces pre-bundling of common deps on dev start (prevents "discovered dependency" reloads)
- `holdUntilCrawlEnd: false` lets Vite serve first requests before the full crawl finishes — faster perceived cold start

## Daily usage

```bash
pnpm dev           # start dev server → http://localhost:5173
pnpm build         # production build → apps/web/dist/
pnpm preview       # preview prod build → http://localhost:4173
```

All three are wrapped by Turbo for caching. `dev` is marked `persistent: true` in `turbo.json` so it's not cached.
