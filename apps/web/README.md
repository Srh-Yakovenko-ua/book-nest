# @app/web

React 18 + Vite 5 + TypeScript frontend for the monorepo-fullstack project.

## Quick commands

From the monorepo root:

```
pnpm dev              # start FE + BE in parallel
pnpm dev:web          # start only the FE dev server on :5173
pnpm typecheck        # turbo-cached type checking
pnpm lint             # ESLint
pnpm format           # Prettier write
pnpm test             # Vitest
pnpm knip             # dead code scanner
```

Per-package:

```
pnpm --filter @app/web build              # production build → dist/
pnpm --filter @app/web preview            # preview prod build on :4173
pnpm --filter @app/web test:watch         # vitest watch mode
pnpm --filter @app/web test:ui            # vitest interactive UI
pnpm --filter @app/web test:coverage      # coverage report
```

## Documentation

Full documentation lives in the repository-level [`docs/`](../../docs/) folder:

- [Architecture](../../docs/architecture.md) — folder structure, feature-sliced design, decision table
- [Stack](../../docs/stack.md) — full dependency list with purpose
- [Workflow](../../docs/workflow.md) — daily commands, quality gates, env variables
- [Patterns](../../docs/patterns.md) — adding a feature, writing forms, fetching data, styling

### Tools reference

- [pnpm workspaces & catalogs](../../docs/tools/monorepo.md)
- [Turborepo](../../docs/tools/turborepo.md)
- [Vite](../../docs/tools/vite.md)
- [TypeScript](../../docs/tools/typescript.md)
- [ESLint](../../docs/tools/eslint.md)
- [Prettier](../../docs/tools/prettier.md)
- [knip](../../docs/tools/knip.md)
- [Husky + lint-staged + commitlint](../../docs/tools/husky-commitlint.md)
- [Vitest + React Testing Library](../../docs/tools/vitest.md)
- [Tailwind CSS v4](../../docs/tools/tailwind.md)
- [shadcn/ui](../../docs/tools/shadcn.md)
- [MCP servers (Playwright, Context7, frontend-design)](../../docs/tools/mcp-servers.md)
