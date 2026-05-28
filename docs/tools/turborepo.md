# Turborepo

## What it is

[Turborepo](https://turborepo.com) is a high-performance task runner for JavaScript/TypeScript monorepos, written in Rust. It wraps your existing `pnpm` scripts and adds:

- **Task caching** — re-runs with unchanged inputs return from local cache instantly
- **Topological ordering** — tasks respect workspace dependency graph (build shared before apps that depend on it)
- **Parallelization** — independent tasks run in parallel across workspaces
- **Affected detection** — `--affected` only runs tasks for packages that changed
- **Remote caching** — optional shared cache across team members and CI

## Why we have it

Without Turbo, every `pnpm typecheck` or `pnpm build` re-runs from scratch. With Turbo, unchanged code returns from cache in milliseconds.

Real measurement from this repo:

| Command          | Cold (first run) | Cached (re-run) | Speedup |
| ---------------- | ---------------- | --------------- | ------- |
| `pnpm typecheck` | ~3.1 s           | ~23 ms          | ~135×   |
| `pnpm build`     | ~4.0 s           | instant         | huge    |

## Config — `turbo.json`

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "stream",
  "globalDependencies": [
    "tsconfig.base.json",
    ".env",
    ".env.local",
    "pnpm-workspace.yaml",
    ".prettierrc",
    ".prettierignore",
    "eslint.config.mjs"
  ],
  "globalEnv": ["NODE_ENV", "CI"],
  "tasks": {
    "build":     { "dependsOn": ["^build"], "inputs": [...], "outputs": ["dist/**"], "env": ["VITE_*"] },
    "typecheck": { "dependsOn": ["^typecheck"], "inputs": [...] },
    "lint":      { "inputs": [...] },
    "test":      { "dependsOn": ["^build"], "inputs": [...], "outputs": ["coverage/**"] },
    "dev":       { "cache": false, "persistent": true }
  }
}
```

### Field meanings

| Field                | Meaning                                                                                |
| -------------------- | -------------------------------------------------------------------------------------- |
| `globalDependencies` | Files that invalidate **all** caches when changed (root configs)                       |
| `globalEnv`          | Env vars that invalidate caches (e.g., `CI`)                                           |
| `tasks.X.dependsOn`  | What must run before this task. `^build` means "build in upstream packages first"      |
| `tasks.X.inputs`     | Files that trigger cache invalidation for this task                                    |
| `tasks.X.outputs`    | Files/dirs that are cached as the task's result (`dist/**`, `coverage/**`)             |
| `tasks.X.env`        | Env vars that should be cached as part of the task input (e.g., `VITE_*` for build)    |
| `tasks.X.cache`      | Set to `false` for tasks that should never be cached (dev servers)                     |
| `tasks.X.persistent` | Marks long-running tasks (dev servers). Turbo won't hold off downstream tasks on these |

## How cache invalidation works

Turbo computes a hash from:

- File inputs (whitelisted via `inputs`)
- Dependencies in `package.json`
- Environment variables from `env` / `globalEnv`
- Global dependencies (`globalDependencies`)

If the hash matches a previous run, Turbo replays the stored output. Otherwise it runs the task and caches the result.

The cache lives at `node_modules/.cache/turbo/` (hidden from git via `.gitignore`).

## Daily usage

```bash
pnpm typecheck       # runs turbo run typecheck
pnpm build           # runs turbo run build
pnpm test            # runs turbo run test
```

Turbo filter syntax for per-package runs:

```bash
pnpm build --filter=@app/web       # build only FE
pnpm build --filter=@app/web...    # build FE + its upstream deps
pnpm build --filter=...@app/web    # build FE + its downstream deps
pnpm test --filter='[main]'        # run tests for packages changed vs main branch
```

## Full Turbo badge

When a command returns entirely from cache, Turbo shows:

```
 Tasks:    3 successful, 3 total
 Cached:   3 cached, 3 total
   Time:   23ms >>> FULL TURBO
```

## Not enabled (intentionally)

- **Remote caching** — Vercel-hosted team cache. Requires account + token. We don't use it in a solo project.
- **Turbo prune** — `turbo prune` generates a minimal subset of the monorepo for Docker deploys. We'll enable when we add Dockerfile.
- **Task filtering by changed files** in CI — `turbo run build --affected` needs git history. We'll enable when CI is set up.
