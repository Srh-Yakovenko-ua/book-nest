# knip

## What it is

[knip](https://knip.dev) is a dead code and dead dependency scanner for JavaScript/TypeScript monorepos. It finds:

- **Unused files** — files that no other file imports (orphans)
- **Unused dependencies** — packages in `package.json` that no source file imports
- **Unused devDependencies** — same for dev deps
- **Unused exports** — exported symbols that nothing imports
- **Unused exported types** — same for types
- **Unlisted dependencies** — packages imported but not listed in `package.json` (a crash waiting to happen in prod)
- **Duplicated exports** — the same name exported from multiple places

## Why we have it

Without knip, dead code accumulates:

- A removed feature leaves behind hooks and utilities that look like "shared infrastructure" but nothing imports them anymore
- Refactors leave half-deleted exports that future readers waste time on
- `package.json` grows with deps you don't use, bloating `node_modules`
- PRs add deps that aren't listed in `package.json` (works locally because of hoisting, breaks in CI or Docker)

knip catches all of these in one command.

## Config — `knip.json`

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "ignoreExportsUsedInFile": true,
  "workspaces": {
    ".": {},
    "apps/web": {
      "project": ["src/**/*.{ts,tsx}"],
      "ignore": ["src/components/ui/**", "src/test-utils.tsx"],
      "ignoreDependencies": [
        /* forward-loaded packages */
      ]
    },
    "apps/api": { "project": ["src/**/*.ts"] },
    "packages/shared": { "project": ["src/**/*.ts"] }
  }
}
```

### Field meanings

| Field                     | Meaning                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `workspaces`              | Per-package overrides. `.` targets the root.                                                                    |
| `project`                 | Glob of files to analyze for usage                                                                              |
| `ignore`                  | Files/globs that knip should not report as unused                                                               |
| `ignoreDependencies`      | Packages to skip in the "unused dependency" check — use for forward-loaded packages installed ahead of features |
| `ignoreExportsUsedInFile` | When `true`, an export used inside the same file doesn't count as unused                                        |

### Why we ignore some things

- **`src/components/ui/**`\*\* — shadcn vendored code; they legitimately export helpers that nothing imports yet
- **`src/test-utils.tsx`** — infrastructure file, will be used when tests are written
- **Forward-loaded dependencies** (`@tanstack/react-table`, `recharts`, `zod`, `react-hook-form`, etc.) — installed ahead of time because we know we'll need them; knip correctly flags them as unused until features use them, so we ignore them by name

## Daily usage

```bash
pnpm knip              # scan, exits 1 if issues found
pnpm knip:fix          # same but auto-removes obvious dead code
```

Both scripts are defined in the root `package.json` and run against the entire workspace.

## Reading the output

Example output:

```
Unused files (1)
apps/web/src/test-utils.tsx

Unused dependencies (1)
axios                     apps/web/package.json:21:6

Unused exports (1)
ApiError  class           apps/web/src/lib/http-client.ts:1:14

Unlisted dependencies (1)
@vitest/coverage-v8       apps/web/vitest.config.ts
```

| Category              | What to do                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Unused files          | Either delete the file, import it from somewhere, or add to `ignore` if it's infrastructure                                      |
| Unused dependencies   | `pnpm --filter X remove Y` or add to `ignoreDependencies` if forward-loaded                                                      |
| Unused exports        | Remove the `export` keyword, or add to `ignore*` if kept for future use                                                          |
| Unlisted dependencies | `pnpm --filter X add Y` — the code references a package that's not in `package.json`, meaning it works locally only via hoisting |
| Duplicate exports     | Rename one of them to avoid confusion                                                                                            |

## Versions

We use **knip 5** (not 6) because knip 6 uses `oxc-parser` which has Node 20.12 ESM interop issues. Knip 5 uses the TypeScript compiler directly and works on our Node version. When we bump Node to 20.19+, we can upgrade knip to 6.
