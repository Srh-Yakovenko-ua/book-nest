# pnpm workspaces & catalogs

## What they are

[pnpm](https://pnpm.io) is a package manager that uses a content-addressable store and symlinked `node_modules`. It supports **workspaces** natively — multiple packages in one repo sharing a single lockfile.

**Catalogs** (pnpm 10+) are a way to define shared dependency versions in one place and reference them from multiple `package.json` files via `"react": "catalog:"`.

## Why we have them

- **Single lockfile** — one source of truth for all dependency resolution across the repo
- **Workspace protocol** — `"@app/shared": "workspace:*"` creates a symlink; local changes propagate instantly without republishing
- **Efficient disk usage** — pnpm stores packages once globally; `node_modules` contains symlinks to the store
- **Catalogs** — eliminate version drift: React 18.3.1 is defined once in `pnpm-workspace.yaml`, and both `apps/web` and `packages/shared` reference it as `catalog:`

## `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"

catalogMode: prefer

catalog:
  react: ^18.3.1
  react-dom: ^18.3.1
  "@types/react": ^18.3.3
  "@types/react-dom": ^18.3.0
  typescript: ^5.5.4
  vite: ^5.4.0
  turbo: ^2.9.6
  react-scan: ^0.4.5
  web-vitals: ^5.1.1
```

### Fields

| Field         | Meaning                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `packages`    | Glob patterns for workspace packages                                                           |
| `catalogMode` | `prefer` = when `pnpm add X` is run, add `X` to the catalog automatically if not already there |
| `catalog`     | Default catalog — package names to version ranges                                              |

### Referencing a catalog version

In `apps/web/package.json`:

```json
{
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:"
  }
}
```

At install time, pnpm replaces `catalog:` with the version from `pnpm-workspace.yaml`. If you bump the catalog, all workspaces get the new version on next `pnpm install`.

## `.npmrc` — senior tuning

```ini
save-exact=false
strict-peer-dependencies=false
auto-install-peers=true

link-workspace-packages=deep
prefer-workspace-packages=true
save-workspace-protocol=rolling

dedupe-direct-deps=true
dedupe-peer-dependents=true

resolve-peers-from-workspace-root=true

enable-pre-post-scripts=true
```

### Key settings

| Setting                                  | Why                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `save-exact=false`                       | Use caret ranges (`^1.2.3`) by default                                                         |
| `auto-install-peers=true`                | Install peer dependencies automatically (avoids noisy warnings)                                |
| `link-workspace-packages=deep`           | Use workspace package if available, even for transitive deps                                   |
| `prefer-workspace-packages=true`         | Prefer workspace version when resolving                                                        |
| `save-workspace-protocol=rolling`        | When `pnpm add @app/shared` runs, it writes `workspace:^` (compatible with future minor bumps) |
| `dedupe-direct-deps=true`                | Dedupe direct dependencies across the workspace                                                |
| `dedupe-peer-dependents=true`            | Dedupe packages that are peer-dependents of multiple others                                    |
| `resolve-peers-from-workspace-root=true` | Peer deps are resolved from the workspace root first                                           |

## `onlyBuiltDependencies`

In the root `package.json`:

```json
{
  "pnpm": {
    "onlyBuiltDependencies": [
      "esbuild",
      "oxc-parser",
      "oxc-resolver",
      "@parcel/watcher",
      "unrs-resolver",
      "@swc/core"
    ]
  }
}
```

By default, pnpm 10 does **not** run postinstall scripts of dependencies (security: malicious postinstall is a known supply-chain attack). Listing a package in `onlyBuiltDependencies` explicitly allows its postinstall to run.

We allow postinstall for native binaries that genuinely need to be built/downloaded:

- `esbuild` — used by Vite, downloads native binary for the platform
- `oxc-parser`, `oxc-resolver`, `unrs-resolver` — used by knip and similar tools
- `@parcel/watcher` — file watcher used by husky
- `@swc/core` — used by `@vitejs/plugin-react-swc`

## `@app/shared` package

Lives in `packages/shared/` — minimal TypeScript package with types shared between FE and BE.

### `packages/shared/package.json`

```json
{
  "name": "@app/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./package.json": "./package.json"
  },
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "files": ["src"],
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

### Key choices

| Field                | Meaning                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `type: "module"`     | Package is ESM-only                                                                       |
| `sideEffects: false` | Tells Vite/Rollup this package has no side effects — enables more aggressive tree-shaking |
| `exports`            | Modern entry point declaration with `types`, `import`, `default` conditions               |
| `main`/`types`       | Legacy fields for tooling that doesn't understand `exports` yet                           |
| `files`              | What would be included if we ever published this package — only `src/`                    |

### Usage from FE or BE

```ts
import type { ApiHealth, ApiError } from "@app/shared";
```

Because we point `types` directly at the source `.ts` file, no build step is needed. Vite and tsx both handle TypeScript imports across workspace packages natively.

## Daily commands

```bash
pnpm install                          # install all workspace deps
pnpm add <pkg>                        # adds to root package.json
pnpm --filter @app/web add <pkg>      # adds to apps/web
pnpm --filter @app/web add -D <pkg>   # adds as devDependency
pnpm --filter @app/web remove <pkg>   # remove from apps/web
pnpm update -r                        # update all packages interactively
pnpm dedupe                           # dedupe the lockfile
```
