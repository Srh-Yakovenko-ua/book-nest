# ESLint

## What it is

[ESLint](https://eslint.org) is a static analyzer for JavaScript and TypeScript code. It catches bugs, enforces patterns, and prevents common mistakes that the TypeScript compiler does not cover (like React hook rules, accessibility issues, import cycles, style drift).

## Why we have it

The TypeScript compiler checks types. ESLint checks **patterns**:

- React rules (rules of hooks, JSX correctness)
- Accessibility in JSX (missing `alt`, wrong ARIA, `<label>` without `htmlFor`)
- Tailwind class correctness (unknown classes, conflicts, deprecated)
- Import correctness (cycles, duplicates, self-imports)
- Code style (import order, JSX prop order, object key order)
- Test anti-patterns (on test files only)

Together with Prettier and TypeScript, ESLint forms the three-layer quality gate: **types correct (tsc) + patterns correct (eslint) + formatted (prettier)**.

## Config — `eslint.config.mjs`

We use the modern **flat config** format (ESLint 9+). A single file at the root applies to the entire monorepo. Per-package rules are done via `files` globs inside the same config.

### Plugins active

| Plugin                              | Purpose                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| `@eslint/js`                        | core JavaScript rules                                                                |
| `typescript-eslint`                 | TypeScript-aware rules                                                               |
| `eslint-plugin-react`               | React-specific rules (valid JSX, no unknown DOM props, etc.)                         |
| `eslint-plugin-react-hooks`         | enforces [rules of hooks](https://react.dev/reference/rules/rules-of-hooks)          |
| `eslint-plugin-react-refresh`       | warns if a file exports both components and non-components (breaks HMR)              |
| `eslint-plugin-jsx-a11y`            | accessibility in JSX — alt text, label/input association, ARIA correctness           |
| `eslint-plugin-better-tailwindcss`  | lints Tailwind classes: unknown, conflicting, duplicate, deprecated v3 names         |
| `eslint-plugin-perfectionist`       | auto-sorts imports, object literal keys, JSX props, union type members               |
| `eslint-plugin-import-x`            | import rules: `no-cycle`, `no-self-import`, `no-duplicates`                          |
| `eslint-import-resolver-typescript` | resolver for TypeScript path aliases (`@/*`)                                         |
| `@vitest/eslint-plugin`             | Vitest-specific rules (on `*.test.*` and `*.spec.*` files only)                      |
| `eslint-plugin-testing-library`     | React Testing Library anti-patterns (on test files only)                             |
| `eslint-config-prettier`            | must be last in the chain — disables any rule that would fight Prettier's formatting |

### Per-scope config

| Scope                           | Applied rules                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `**/*.{ts,tsx,js,jsx}`          | js recommended + typescript-eslint recommended + perfectionist sorting           |
| `apps/web/**/*.{ts,tsx}`        | + React + React Hooks + React Refresh + jsx-a11y + better-tailwindcss + import-x |
| `apps/api/**/*.ts`              | + Node.js globals                                                                |
| `apps/web/src/components/ui/**` | jsx-a11y/a11y rules OFF (vendored shadcn code), tailwindcss rules OFF            |
| `**/*.{test,spec}.{ts,tsx}`     | + vitest + testing-library rules                                                 |

### Key rule adjustments

| Rule                                                | Setting                           | Why                                                                            |
| --------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------ |
| `@typescript-eslint/no-unused-vars`                 | warn, `^_` prefix ignored         | Express middleware often has unused `next`, we use `_next` to silence          |
| `react/react-in-jsx-scope`                          | off                               | Not needed with React 17+ automatic JSX transform                              |
| `react/prop-types`                                  | off                               | We use TypeScript, not prop-types                                              |
| `react-refresh/only-export-components`              | warn, `allowConstantExport: true` | Off for vendored `components/ui/**` because shadcn co-exports cva helpers      |
| `better-tailwindcss/enforce-consistent-class-order` | off                               | `prettier-plugin-tailwindcss` handles class ordering                           |
| `better-tailwindcss/no-unknown-classes`             | warn with ignore list             | Ignores shadcn-specific classes like `dark`, `group`, `peer`, `fill-mode-both` |
| `import-x/no-cycle`                                 | warn                              | Circular imports → warning, not error (legitimate in rare cases)               |

## Daily usage

```bash
pnpm lint             # lint everything (exits 1 on any error)
pnpm lint:fix         # auto-fix what can be fixed
```

The `pre-commit` hook (via `lint-staged`) runs `eslint --fix` on staged files only, so most problems get fixed before commit.

## Exit codes

| Exit | Meaning                        |
| ---- | ------------------------------ |
| 0    | No problems                    |
| 1    | At least one error or warning  |
| 2    | Config error (misspelled rule) |

## Relationship with Prettier

ESLint and Prettier have overlapping responsibilities around whitespace and punctuation. To prevent conflicts:

- `eslint-config-prettier` is included **last** in the config chain. It turns off any ESLint rule that would disagree with Prettier.
- Formatting is entirely Prettier's job. ESLint never reformats — it only reports logical issues.
- Both tools run in `lint-staged` on pre-commit, in the right order: `eslint --fix` first (fixes logic), then `prettier --write` (formats).
