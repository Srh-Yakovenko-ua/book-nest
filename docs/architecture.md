# Architecture

## Monorepo layout

```
monorepo-fullstack/
├── apps/
│   ├── web/           React 18 + Vite 5 + TypeScript SPA
│   └── api/           Express + Mongoose + TypeScript (phase 1)
├── packages/
│   └── shared/        TypeScript types shared between FE and BE (@app/shared)
└── docs/              project documentation
```

- `apps/*` — deployable applications
- `packages/*` — internal libraries consumed by workspace apps via `workspace:*`
- Single `pnpm-lock.yaml` at the root (pnpm workspaces)
- Single ESLint config, Prettier config, TypeScript base config, Turborepo config

## apps/web — feature-sliced layout

```
apps/web/src/
├── main.tsx                    entry: providers, error handlers, web vitals
├── App.tsx                     createBrowserRouter + lazy routes
├── env.d.ts                    import.meta.env + __DEV__/__PROD__ globals
├── index.css                   Tailwind imports + theme variables
├── test-utils.tsx              renderWithProviders / renderWithRouter
│
├── routes/                     routing-level concerns (not features)
│   ├── layouts/app-shell.tsx   shared topbar + <Outlet />
│   ├── error-boundary.tsx      router errorElement
│   └── not-found-page.tsx      catch-all * route
│
├── features/                   vertical slices
│   └── health/
│       ├── index.ts            public API of the feature (barrel re-export)
│       ├── api.ts              healthApi.get()
│       ├── hooks/use-health.ts useQuery wrapper
│       ├── components/         feature-local components
│       ├── lib/                feature-local pure functions
│       └── pages/              feature pages
│
├── components/                 cross-feature UI
│   ├── ui/                     shadcn vendored (do not hand-edit)
│   ├── theme-picker.tsx        shared topbar widget
│   └── page-loading.tsx        Suspense fallback
│
├── hooks/                      cross-feature hooks
│   ├── use-theme.ts            light/dark/system
│   └── use-page-title.ts       sets document.title
│
└── lib/                        cross-feature infrastructure (no React)
    ├── http-client.ts          fetch wrapper: request<T>() + ApiError
    ├── query-client.ts         QueryClient singleton
    ├── utils.ts                cn() — clsx + tailwind-merge
    ├── format.ts               formatTimestamp (generic)
    ├── logger.ts               createLogger(scope)
    ├── error-handlers.ts       installGlobalErrorHandlers()
    └── vitals.ts               reportWebVitals()
```

## Feature-sliced design

Every feature lives in a single folder under `src/features/<name>/`. The folder contains everything the feature needs: its API calls, hooks, components, pages, and local utilities.

Each feature has an `index.ts` that acts as its **public API** — only things re-exported from `index.ts` are meant to be used by other code. Internals (like `StatusDot` inside `features/health/components/`) are private to the feature.

### Rationale

- **Cohesion** — all code for one feature lives together; finding things is linear
- **Deletion** — removing a feature = `rm -rf features/<name>` + two lines in `App.tsx`
- **Isolation** — features cannot accidentally import each other's internals
- **Scalability** — new feature = new folder, no churn in shared directories

## Where new code goes — decision table

| New code                                          | Goes in                                               |
| ------------------------------------------------- | ----------------------------------------------------- |
| A whole new feature                               | `src/features/<name>/` with the full structure        |
| A page that belongs to a feature                  | `src/features/<name>/pages/`                          |
| A page that is routing-level (404, error, login?) | `src/routes/`                                         |
| A layout (topbar, sidebar, split pane)            | `src/routes/layouts/`                                 |
| A component used only by one feature              | `src/features/<name>/components/`                     |
| A component used by 2+ features                   | `src/components/` (promoted from feature)             |
| A hook used only by one feature                   | `src/features/<name>/hooks/`                          |
| A hook used by 2+ features                        | `src/hooks/` (promoted from feature)                  |
| A pure function used by one feature               | `src/features/<name>/lib/`                            |
| A pure function used by 2+ features               | `src/lib/` (promoted from feature)                    |
| Shadcn vendored component                         | Never hand-edit — `pnpm dlx shadcn@latest add <name>` |

## YAGNI promotion rule

Code starts in a feature folder. It is promoted to `src/components/`, `src/hooks/`, or `src/lib/` **only when a second feature needs it**. No premature "shared" code — premature promotion creates abstractions that fit the first feature but don't serve later ones.

## apps/api — layered backend

```
apps/api/src/
├── index.ts              entry: connect DB → start server → graceful shutdown
├── app.ts                createApp() — Express builder, separate from listen
├── config/
│   └── env.ts            typed env reader
├── db/
│   └── mongo.ts          mongoose connect/disconnect
├── routes/               URL → controller mapping only
├── controllers/          req/res parsing, no business logic
├── services/             pure business logic, no HTTP awareness
└── middleware/           express middleware (errorHandler, ...)
```

The layer separation (routes → controllers → services) is intentional and prepares for phase 2: migration to NestJS where services become `@Injectable()` classes, controllers become `@Controller` methods, and routes become decorators.

## Rules of import flow

- `lib/` can import from itself only (no React, no features)
- `hooks/` can import from `lib/` and from other `hooks/`
- `components/` can import from `lib/`, `hooks/`, `components/ui/`
- `features/*/` can import from everything except other features
- `features/foo/` cannot import from `features/bar/` (enforced by convention, not tooling yet)
- `routes/` can import features (via their `index.ts` public API)
- Shadcn `components/ui/**` can import only from `lib/utils` and other `components/ui/**`
