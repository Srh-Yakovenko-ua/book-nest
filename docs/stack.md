# Stack

## Summary

| Layer           | Choice                                     |
| --------------- | ------------------------------------------ |
| Language        | TypeScript 5.9 (strict)                    |
| Package manager | pnpm 10 with workspaces + catalogs         |
| Task runner     | Turborepo                                  |
| FE framework    | React 18.3                                 |
| FE build        | Vite 5.4 + `@vitejs/plugin-react-swc`      |
| FE styling      | Tailwind CSS v4                            |
| FE UI kit       | shadcn/ui (radix-nova preset)              |
| FE routing      | React Router v7                            |
| FE server state | TanStack Query v5                          |
| FE UI state     | Zustand                                    |
| FE forms        | react-hook-form + zod                      |
| FE tests        | Vitest + React Testing Library + happy-dom |
| BE framework    | Express 4 (phase 1)                        |
| BE ORM          | Mongoose 8 (phase 1)                       |
| BE database     | MongoDB (phase 1)                          |
| BE framework    | NestJS (planned phase 2)                   |
| BE database     | PostgreSQL (planned phase 2)               |

## FE runtime dependencies

### Framework core

| Package        | Purpose                                            |
| -------------- | -------------------------------------------------- |
| `react`        | React 18 with concurrent features                  |
| `react-dom`    | DOM renderer                                       |
| `react-router` | v7 — `createBrowserRouter`, `lazy`, `errorElement` |
| `@app/shared`  | monorepo workspace package for FE↔BE types         |

### Data & forms

| Package                                  | Purpose                                                |
| ---------------------------------------- | ------------------------------------------------------ |
| `@tanstack/react-query`                  | server state cache, retries, dedup, background refetch |
| `@tanstack/react-query-persist-client`   | persist cache between reloads                          |
| `@tanstack/query-sync-storage-persister` | localStorage adapter for persist plugin                |
| `@tanstack/react-table`                  | headless sortable/filterable tables                    |
| `@tanstack/react-virtual`                | virtualized long lists                                 |
| `react-hook-form`                        | uncontrolled form library, no re-renders on typing     |
| `@hookform/resolvers`                    | bridge between react-hook-form and zod                 |
| `zod`                                    | runtime schema validation + inferred TypeScript types  |
| `zustand`                                | small global UI state store (no provider needed)       |
| `superjson`                              | serializer supporting `Date`, `Map`, `Set`, `BigInt`   |
| `nanoid`                                 | compact unique IDs                                     |
| `date-fns`                               | date manipulation (tree-shakeable)                     |
| `ts-pattern`                             | exhaustive pattern matching                            |
| `type-fest`                              | TypeScript utility types                               |

### UI primitives

| Package                    | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| `radix-ui`                 | all Radix primitives in one unified package             |
| `lucide-react`             | icon set (tree-shakeable)                               |
| `sonner`                   | toast notifications                                     |
| `cmdk`                     | Cmd+K palette (used by shadcn `command`)                |
| `vaul`                     | mobile drawer (used by shadcn `drawer`)                 |
| `react-day-picker`         | calendar (used by shadcn `calendar`)                    |
| `input-otp`                | OTP input (used by shadcn `input-otp`)                  |
| `recharts`                 | charts (used by shadcn `chart`)                         |
| `class-variance-authority` | variant definitions for shadcn components               |
| `clsx`                     | conditional className utility                           |
| `tailwind-merge`           | resolves conflicting Tailwind classes                   |
| `tw-animate-css`           | Tailwind plugin for enter/exit animations               |
| `next-themes`              | pulled transitively by shadcn `sonner`, unused directly |
| `shadcn`                   | CLI — used via `pnpm dlx shadcn@latest`                 |

### Fonts & observability

| Package                                    | Purpose                                |
| ------------------------------------------ | -------------------------------------- |
| `@fontsource-variable/bricolage-grotesque` | primary sans display font              |
| `@fontsource-variable/geist-mono`          | monospace font for technical labels    |
| `web-vitals`                               | CLS / FCP / INP / LCP / TTFB reporting |

## FE dev dependencies

### Testing

| Package                       | Purpose                                             |
| ----------------------------- | --------------------------------------------------- |
| `vitest`                      | test runner (Vite-native)                           |
| `@vitest/ui`                  | interactive test UI                                 |
| `@vitest/coverage-v8`         | coverage provider                                   |
| `@testing-library/react`      | component testing helpers                           |
| `@testing-library/jest-dom`   | DOM matchers                                        |
| `@testing-library/user-event` | realistic user interactions                         |
| `happy-dom`                   | lightweight browser environment (faster than jsdom) |

### Build & tooling

| Package                      | Purpose                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `vite`                       | dev server + build                                      |
| `@vitejs/plugin-react-swc`   | React fast refresh via SWC (Rust)                       |
| `@tailwindcss/vite`          | Tailwind v4 Vite plugin                                 |
| `tailwindcss`                | Tailwind v4 core                                        |
| `vite-plugin-svgr`           | import SVG as React component                           |
| `vite-plugin-checker`        | TS errors in browser overlay during dev                 |
| `vite-plugin-compression2`   | gzip + brotli at build time                             |
| `rollup-plugin-visualizer`   | bundle treemap → `dist/stats.html` after build          |
| `@total-typescript/ts-reset` | improves built-in TS types (Array.includes, JSON.parse) |
| `@types/react`               | React type definitions                                  |
| `@types/react-dom`           | ReactDOM type definitions                               |
| `@types/node`                | Node.js type definitions                                |
| `typescript`                 | compiler (workspace catalog version)                    |

### Dev-only diagnostics (dynamically imported in `main.tsx` under `__DEV__`)

| Package                          | Purpose                                            |
| -------------------------------- | -------------------------------------------------- |
| `react-scan`                     | visual overlay of component re-renders             |
| `@axe-core/react`                | accessibility warnings in browser console          |
| `@tanstack/react-query-devtools` | floating panel showing all queries and cache state |
| `@hookform/devtools`             | inspector for react-hook-form state                |

## Root-level tooling (devDependencies of the root `package.json`)

| Package                             | Purpose                                                |
| ----------------------------------- | ------------------------------------------------------ |
| `turbo`                             | task runner + cache for the monorepo                   |
| `eslint`                            | linter                                                 |
| `typescript-eslint`                 | TS-aware linter rules                                  |
| `@eslint/js`                        | core JS linter rules                                   |
| `eslint-config-prettier`            | disables rules that fight Prettier                     |
| `eslint-plugin-react`               | React-specific rules                                   |
| `eslint-plugin-react-hooks`         | rules of hooks                                         |
| `eslint-plugin-react-refresh`       | HMR safety rules                                       |
| `eslint-plugin-jsx-a11y`            | accessibility linting                                  |
| `eslint-plugin-better-tailwindcss`  | Tailwind class linting                                 |
| `eslint-plugin-perfectionist`       | auto-sort imports, objects, JSX props, union types     |
| `eslint-plugin-import-x`            | import rules (no-cycle, no-self-import, no-duplicates) |
| `eslint-import-resolver-typescript` | resolver for path aliases                              |
| `@vitest/eslint-plugin`             | vitest-specific rules (on test files)                  |
| `eslint-plugin-testing-library`     | RTL anti-pattern rules (on test files)                 |
| `globals`                           | ESLint globals definitions                             |
| `prettier`                          | formatter                                              |
| `prettier-plugin-tailwindcss`       | auto-sort Tailwind classes                             |
| `husky`                             | git hooks                                              |
| `lint-staged`                       | run linters only on staged files                       |
| `@commitlint/cli`                   | conventional commit enforcement                        |
| `@commitlint/config-conventional`   | conventional commit rule set                           |
| `knip`                              | dead code / dead dependency scanner                    |
