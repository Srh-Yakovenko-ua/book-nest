# TypeScript

## What it is

[TypeScript](https://www.typescriptlang.org) is JavaScript with a static type system. The compiler (`tsc`) checks types and emits plain JS.

## Why we have it (and why strict)

- **Catch bugs at compile time** that JavaScript only catches at runtime (null access, wrong argument types, missing properties)
- **Self-documenting APIs** — function signatures describe expected inputs and outputs
- **Refactoring safety** — rename a field and tsc tells you every place that breaks
- **Editor support** — autocomplete, go-to-definition, find-usages

We use **strict mode + several extra senior flags** to maximize the type system's leverage.

## Config layers

```
/tsconfig.base.json              ← shared strict compiler options
├── apps/web/tsconfig.json       ← extends base, adds DOM libs + path alias + JSX
├── apps/web/vitest.config.ts    ← uses apps/web/tsconfig.json implicitly via Vite
├── apps/api/tsconfig.json       ← extends base, adds node types
├── apps/api/tsconfig.build.json ← extends api tsconfig for build (emit)
└── packages/shared/tsconfig.json ← extends base, noEmit (source as main/types)
```

## `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "declaration": true,
    "sourceMap": true
  }
}
```

### Flag explanations

| Flag                               | What it does                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| `target: "ES2022"`                 | Output modern JavaScript (top-level await, class fields)                           |
| `module: "ESNext"`                 | Keep `import`/`export` syntax (Vite handles bundling)                              |
| `moduleResolution: "Bundler"`      | Modern resolution mode tailored for Vite/Rollup                                    |
| `lib: ["ES2022"]`                  | Available built-in types; app tsconfigs add `DOM` on top                           |
| `strict: true`                     | Enables all basic strict flags (strictNullChecks, noImplicitAny, etc.)             |
| `esModuleInterop: true`            | Cleaner CommonJS interop (`import x from "cjs-module"`)                            |
| `forceConsistentCasingInFileNames` | Prevents casing bugs on case-insensitive filesystems (macOS)                       |
| `skipLibCheck: true`               | Don't type-check node_modules — faster and less noise                              |
| `resolveJsonModule: true`          | Allow `import data from "./data.json"`                                             |
| `isolatedModules: true`            | Every file must be independently transpilable (required by Vite/SWC)               |
| `verbatimModuleSyntax: true`       | Requires `import type` for type-only imports; prevents legacy `import = require()` |
| `noUncheckedIndexedAccess: true`   | `arr[0]` returns `T \| undefined` — catches accidental undefined access            |
| `noImplicitOverride: true`         | Subclasses must use the `override` keyword                                         |
| `noImplicitReturns: true`          | Every function branch must return (caught bugs in conditional early-returns)       |
| `noFallthroughCasesInSwitch: true` | Fall-through in switch statements is an error (`break` required)                   |
| `useUnknownInCatchVariables: true` | `catch (e)` types `e` as `unknown`, not `any` — forces narrowing                   |
| `allowUnreachableCode: false`      | Dead code after `return` is an error                                               |
| `allowUnusedLabels: false`         | Unused labels are an error                                                         |
| `declaration: true`                | Emit `.d.ts` files (relevant only for packages that publish)                       |
| `sourceMap: true`                  | Emit source maps                                                                   |

### Strict flags we DO NOT enable (and why)

| Flag                                 | Reason for skipping                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `exactOptionalPropertyTypes`         | Conflicts with third-party types (Radix, Sonner, React Day Picker) that accept `undefined` for optional props. Noise > value.    |
| `noPropertyAccessFromIndexSignature` | Vite's `ImportMetaEnv` has an index signature, so every `import.meta.env.VITE_X` would require bracket access. Friction > value. |

These are the two most pedantic strict flags; experienced teams often skip them for exactly the same reasons.

## Path aliases

Defined in `apps/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

And mirrored in `vite.config.ts`:

```ts
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
}
```

Both sides must match. TypeScript uses the tsconfig alias for type resolution; Vite uses its alias for actual import resolution at dev/build time.

Usage:

```ts
import { Button } from "@/components/ui/button";
import { useHealth } from "@/features/health/hooks/use-health";
```

## `@total-typescript/ts-reset`

A tiny package of type declaration overrides that improves the built-in TypeScript types:

- `JSON.parse` returns `unknown` instead of `any` — forces you to validate the result
- `Array.prototype.includes` accepts a wider argument type — catches typos in string comparisons
- `.filter(Boolean)` properly narrows `Array<T | null>` to `Array<T>`
- `fetch` response types are slightly more honest

Activated by a single import in `apps/web/src/env.d.ts`:

```ts
import "@total-typescript/ts-reset";
```

## `env.d.ts` — ambient types for Vite

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
import "@total-typescript/ts-reset";

declare global {
  const __APP_VERSION__: string;
  const __DEV__: boolean;
  const __PROD__: boolean;

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
  }
}

export {};
```

The `declare global` block is required because the `import "@total-typescript/ts-reset"` makes the file a module; bare `declare const` inside a module is local, not global.

## Daily usage

```bash
pnpm typecheck       # runs turbo run typecheck across packages
```

Turbo caches the typecheck result, so re-runs with unchanged files finish in ~30 ms (`FULL TURBO`).
