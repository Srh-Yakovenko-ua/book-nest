# Prettier

## What it is

[Prettier](https://prettier.io) is an opinionated code formatter. It parses your code and re-prints it in a consistent style, removing all bikeshedding about whitespace, quotes, semicolons, and line length.

## Why we have it

- **Consistent style** without debate — every file looks the same regardless of who wrote it
- **Zero overhead per developer** — no need to think about formatting, just save
- **Clean diffs** — no whitespace noise in PRs
- **Auto-sorting of Tailwind classes** via `prettier-plugin-tailwindcss` — classes always appear in canonical order (layout → flex → spacing → typography → colors)

## Config — `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf",
  "bracketSpacing": true,
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "./apps/web/src/index.css",
  "tailwindFunctions": ["cn", "cva", "clsx", "twMerge"]
}
```

### Rule rationale

| Option               | Value      | Why                                                             |
| -------------------- | ---------- | --------------------------------------------------------------- |
| `semi`               | `true`     | ASI hazards — explicit semicolons prevent edge-case bugs        |
| `singleQuote`        | `false`    | Double quotes for strings (TypeScript default, JSX consistency) |
| `trailingComma`      | `"all"`    | Cleaner diffs when adding list items                            |
| `printWidth`         | `100`      | Modern monitors; stricter than 80 but not as loose as 120       |
| `tabWidth`           | `2`        | Industry standard for JS/TS                                     |
| `arrowParens`        | `"always"` | `(x) => x` over `x => x` — consistent with multi-arg            |
| `endOfLine`          | `"lf"`     | Unix line endings, controlled across OSes                       |
| `bracketSpacing`     | `true`     | `{ x }` not `{x}` — easier to read                              |
| `plugins`            | tailwind   | auto-sort Tailwind classes                                      |
| `tailwindStylesheet` | index.css  | plugin reads our theme to know which custom classes exist       |
| `tailwindFunctions`  | cn/cva/…   | plugin sorts classes inside these function calls too            |

## `.prettierignore`

```
node_modules
dist
build
.vite
.turbo
pnpm-lock.yaml
*.tsbuildinfo
.playwright-mcp
```

Anything auto-generated or external is excluded from formatting.

## `prettier-plugin-tailwindcss`

This plugin sorts Tailwind utility classes in canonical order on format.

Before:

```tsx
<div className="flex items-center gap-2 rounded-md bg-background p-4 text-sm text-foreground" />
```

After:

```tsx
<div className="flex items-center gap-2 rounded-md bg-background p-4 text-sm text-foreground" />
```

The canonical order is: layout → flexbox/grid → spacing → sizing → typography → backgrounds → borders → effects → transitions → interactivity.

The plugin also sorts classes inside registered functions: `cn()`, `cva()`, `clsx()`, `twMerge()`.

## Daily usage

```bash
pnpm format           # write mode — reformats everything
pnpm format:check     # check mode — exits 1 if anything would change (for CI)
```

The `pre-commit` hook runs `prettier --write` on staged files only via `lint-staged`.

## Relationship with ESLint

See [ESLint](./eslint.md) — `eslint-config-prettier` is the last item in our ESLint config and disables any rule that would fight Prettier. The two tools run in sequence in `lint-staged` on pre-commit.
