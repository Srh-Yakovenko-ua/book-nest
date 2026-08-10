---
name: new-slice
description: Scaffold a new frontend feature slice in apps/web following the project's feature-sliced + Next.js App Router conventions — features/<name>/ (api, hooks, components, index) plus a locale route under app/[locale]/. Use when starting a user-facing frontend feature or adding a new page, and when the user says "новая страница", "сделай фронт для", "новая фича на фронте", "new page", so it lands in the canonical shape instead of ad-hoc.
---

# Scaffold a frontend feature slice (apps/web)

`apps/web` is Next.js 16 (App Router, RSC/SSR) + next-intl, feature-sliced. A feature is a self-contained vertical slice; its routes live in the App Router tree and consume it through the slice's public API. Follow the steps in order; keep the diff minimal and the layers clean (`docs/code-principles.md` §0.0).

## 1. Name and scope

Ask the user for a short kebab-case feature name (e.g. `books`, `book-detail`, `library`) and the route path (e.g. `/books`, `/books/[id]`). Confirm whether it needs the API (`apps/api`) — if so, the contract comes first (step 2); a pure-UI feature skips it.

## 2. API contract first (only if it talks to the backend)

- Add request/response types to `packages/shared/src` (imported as `@app/shared`) — single source of truth for FE↔BE.
- The backend endpoint itself is `backend-engineer`'s job (NestJS module: shared DTO → service → controller → route). Do not write `apps/api` code here — hand that off. This skill scaffolds the FE side that consumes it.

## 3. Create the slice

```
apps/web/src/features/<name>/
├── index.ts              public API barrel — the ONLY entry other code imports
├── api.ts                request<T>() calls + Zod .parse() at the boundary; returns typed data
├── hooks/
│   └── use-<name>.ts     TanStack Query hooks (useQuery/useMutation) wrapping api.ts
├── components/
│   └── <name>-*.tsx      feature-local components ("use client" only where needed)
└── lib/                  feature-local pure utils (optional — add only when real)
```

- **`api.ts`** — uses `request<T>` from `@/lib/http-client` (works server + client). Parse responses with Zod (use `@app/shared` types). No React here.
- **`hooks/`** — `useQuery`/`useMutation`; invalidate related queries after mutations. Client-only.
- **`components/`** — presentational + interactive UI. Add `"use client"` only to components that use hooks/state/events; keep the rest as server components.
- **`index.ts`** — re-export only the public surface (the page-level component, key hooks). `features/<name>` must not import from `features/<other>`.

## 4. Wire the route

Create the page under the locale segment:

```
apps/web/src/app/[locale]/<route>/page.tsx
```

- Server component by default. Pattern:

  ```tsx
  import { hasLocale } from "next-intl";
  import { getTranslations, setRequestLocale } from "next-intl/server";
  import { notFound } from "next/navigation";
  import { routing } from "@/i18n/routing";

  type Props = { params: Promise<{ locale: string }> };

  export async function generateMetadata({ params }: Props) {
    const { locale } = await params;
    const t = await getTranslations({
      locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
      namespace: "<name>",
    });
    return { title: t("title"), description: t("description") };
  }

  export default async function Page({ params }: Props) {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) notFound();
    setRequestLocale(locale);
    return <FeatureView />; // from features/<name>
  }
  ```

- For initial data, prefer fetching in the server component (via `api.ts`) and passing down, or use `HydrationBoundary` with a prefetched `getQueryClient()`. Reach for client `useQuery` when the data is interaction-driven.
- Navigation: use `Link`/`useRouter`/`usePathname` from `@/i18n/navigation`, never `next/link` or `react-router`.

## 5. i18n + finish

- Add every user-facing string as keys under a `<name>` namespace in both locales — use the `/add-i18n-key` skill (keeps uk/en in sync; a hook verifies parity).
- Run the gates: `pnpm --filter @app/web typecheck`, `pnpm exec eslint apps/web`, `pnpm exec prettier --write "apps/web/src/features/<name>/**" "apps/web/src/app/[locale]/<route>/**"`.
- Verify visually: `pnpm dev:web`, open `http://localhost:3000/uk/<route>`, screenshot via Playwright; and `curl -s` the route to confirm content is server-rendered (SEO).

## Rules

- One concern per file; one default export per component file.
- No `console.log` — use `createLogger(scope)` from `@/lib/logger`.
- No comments — names carry meaning.
- No speculative abstraction: create `lib/`, extra components, or shared helpers only when a real second use exists.
- Forms: react-hook-form + zod + shadcn primitives directly — no wrapper `<Form>`.
- Promote code to `src/components|hooks|lib/` only when a second feature needs it.
