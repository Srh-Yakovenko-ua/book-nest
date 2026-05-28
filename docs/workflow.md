# Workflow

## Daily commands

Run from the monorepo root unless noted.

| Command             | Effect                                                  |
| ------------------- | ------------------------------------------------------- |
| `pnpm install`      | Install all workspace dependencies                      |
| `pnpm dev`          | Start FE (`:5173`) + BE (`:4000`) in parallel via Turbo |
| `pnpm dev:web`      | Start only the FE dev server                            |
| `pnpm dev:api`      | Start only the BE dev server                            |
| `pnpm build`        | Build all packages (Turbo-cached)                       |
| `pnpm typecheck`    | TypeScript check across all packages (Turbo-cached)     |
| `pnpm lint`         | ESLint across the repo                                  |
| `pnpm lint:fix`     | ESLint with auto-fix                                    |
| `pnpm format`       | Prettier write mode                                     |
| `pnpm format:check` | Prettier check mode (for CI)                            |
| `pnpm test`         | Vitest run once (Turbo-cached)                          |
| `pnpm knip`         | Dead code + dead dependency scan                        |
| `pnpm clean`        | Turbo clean + remove node_modules + .turbo              |

Per-package scripts:

| Command                                | Effect                              |
| -------------------------------------- | ----------------------------------- |
| `pnpm --filter @app/web build`         | Production build → `apps/web/dist/` |
| `pnpm --filter @app/web preview`       | Serve prod build locally on `:4173` |
| `pnpm --filter @app/web test:watch`    | Vitest watch mode                   |
| `pnpm --filter @app/web test:ui`       | Vitest interactive UI               |
| `pnpm --filter @app/web test:coverage` | Vitest with coverage report         |

## Quality gates

Every change is guarded by five gates. All five must stay green before commit:

1. `pnpm typecheck` — strict TypeScript
2. `pnpm lint` — ESLint with 10 plugins
3. `pnpm format:check` — Prettier
4. `pnpm test` — Vitest
5. `pnpm knip` — no dead code / deps

## Pre-commit hooks

Git hooks are installed by husky on `pnpm install`.

### `pre-commit`

Runs `lint-staged` on staged files only:

- `*.{ts,tsx,js,jsx,mjs,cjs}` → `eslint --fix` + `prettier --write`
- `*.{json,md,yml,yaml,css,html}` → `prettier --write`

A commit with unfixable lint errors is blocked.

### `commit-msg`

Runs `commitlint` against the message. Messages must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

Examples:

```
feat(notes): add create note flow
fix(health): handle timeout on /api/health
chore: bump pnpm to 10.28.1
```

## Environment variables

Template in `apps/web/.env.example`:

```
VITE_API_BASE_URL=
```

Copy to `apps/web/.env.local` for dev.

### FE rules

- Only variables prefixed with `VITE_` are exposed to client code
- Access via `import.meta.env.VITE_X`
- Types are declared in `apps/web/src/env.d.ts`

### Build-time globals (via Vite `define`)

| Constant          | Value                                           |
| ----------------- | ----------------------------------------------- |
| `__APP_VERSION__` | `process.env.npm_package_version` at build time |
| `__DEV__`         | `true` in dev, `false` in prod                  |
| `__PROD__`        | `true` in prod, `false` in dev                  |

Guarded code is dead-code-eliminated by esbuild:

```ts
if (__DEV__) {
  // this entire block is removed from the production bundle
}
```

## Dev-only features (active when `__DEV__ === true`)

Loaded dynamically in `apps/web/src/main.tsx`:

| Tool                  | What it shows                               |
| --------------------- | ------------------------------------------- |
| `react-scan`          | visual overlay of component re-renders      |
| `@axe-core/react`     | a11y warnings in browser console            |
| React Query Devtools  | floating panel with queries and cache state |
| `vite-plugin-checker` | TS errors shown as overlay over the page    |

All of them are tree-shaken out of the production bundle.

## Build output

```
apps/web/dist/
├── index.html
├── favicon.svg
├── stats.html                       bundle treemap (rollup-plugin-visualizer)
└── assets/
    ├── index-[hash].js              app entry
    ├── react-vendor-[hash].js       ~29 KB gzipped
    ├── query-vendor-[hash].js       ~13 KB gzipped
    ├── ui-vendor-[hash].js          ~79 KB gzipped
    ├── index-[hash].css             Tailwind output
    ├── *.woff2                      font files
    └── *.gz, *.br                   pre-compressed versions
```

Initial payload is ~135 KB JS + 17 KB CSS gzipped. Forward-loaded chunks (table, chart, form, date) are tree-shaken to near-zero until their code is imported.
