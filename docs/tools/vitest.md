# Vitest + React Testing Library

## What they are

- [**Vitest**](https://vitest.dev) — a Vite-native test runner. Similar API to Jest, but reuses Vite's transform pipeline so tests run the same way as the app
- [**React Testing Library**](https://testing-library.com/react) — a React component testing library focused on user-visible behavior (what renders, what the user can click) instead of implementation details (props, state, lifecycles)
- [**happy-dom**](https://github.com/capricorn86/happy-dom) — a lightweight DOM implementation used as the test environment; faster than jsdom
- [**@testing-library/jest-dom**](https://github.com/testing-library/jest-dom) — custom matchers like `toBeInTheDocument`, `toHaveAttribute`, `toHaveTextContent`
- [**@testing-library/user-event**](https://testing-library.com/user-event) — realistic user interactions (typing, clicking) that better simulate real browser events than `fireEvent`

## Why we have them

- **Test pyramid foundation** — unit and component tests for fast feedback
- **Same transform as the app** — Vitest uses our `@vitejs/plugin-react-swc`, so JSX and TypeScript work the same way in tests and in the app
- **Fast** — happy-dom is 2-3× faster than jsdom for typical component tests
- **Behavior-focused** — RTL pushes you to test what users see and do, not internal implementation, making tests resilient to refactoring

## Config — `apps/web/vitest.config.ts`

A standalone config (not merged with `vite.config.ts` because vite config is now a callback form):

```ts
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/main.tsx",
        "src/components/ui/**",
      ],
    },
    css: false,
    environment: "happy-dom",
    exclude: ["node_modules", "dist", ".vite"],
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

### Key options

| Option              | Value                           | Purpose                                                                  |
| ------------------- | ------------------------------- | ------------------------------------------------------------------------ |
| `environment`       | `"happy-dom"`                   | Lightweight DOM (faster than jsdom)                                      |
| `globals`           | `true`                          | Auto-inject `describe`, `it`, `expect` — no imports needed in test files |
| `include`           | `src/**/*.{test,spec}.{ts,tsx}` | Only files matching this pattern are run as tests                        |
| `setupFiles`        | `./vitest.setup.ts`             | Runs before every test file                                              |
| `css`               | `false`                         | Don't process CSS imports in tests (irrelevant for behavior tests)       |
| `coverage.provider` | `"v8"`                          | Native V8 coverage (no Babel instrumentation)                            |
| `coverage.exclude`  | shadcn, main.tsx, .d.ts files   | Don't measure coverage on vendored or non-testable code                  |

## Setup file — `apps/web/vitest.setup.ts`

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
```

- Registers `jest-dom` matchers (`toBeInTheDocument`, `toHaveClass`, etc.)
- Runs `cleanup()` after every test to unmount any rendered components and reset the DOM

## Test utilities — `apps/web/src/test-utils.tsx`

A shared toolkit so every test doesn't re-implement provider boilerplate:

```ts
export function createTestQueryClient(): QueryClient { /* fresh client per test */ }

export function renderWithProviders(ui, { queryClient? }) {
  // wraps in <QueryClientProvider>
}

export function renderWithRouter(element, { initialEntries?, queryClient? }) {
  // wraps in <QueryClientProvider> + <RouterProvider> using a memory router
}

// Re-exports so tests only need to import from test-utils:
export { screen, userEvent, waitFor, within, cleanup, render };
```

Usage in a test:

```tsx
import { renderWithProviders, screen, userEvent } from "@/test-utils";
import { NoteForm } from "@/features/notes/components/note-form";

test("creates a note on submit", async () => {
  const onSubmit = vi.fn();
  renderWithProviders(<NoteForm onSubmit={onSubmit} />);

  await userEvent.type(screen.getByLabelText("Title"), "hello");
  await userEvent.type(screen.getByLabelText("Body"), "world");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(onSubmit).toHaveBeenCalledWith({ title: "hello", body: "world" });
});
```

## Daily usage

```bash
pnpm --filter @app/web test              # run once
pnpm --filter @app/web test:watch        # watch mode
pnpm --filter @app/web test:ui           # interactive UI
pnpm --filter @app/web test:coverage     # with coverage report
```

From the root:

```bash
pnpm test                                # Turbo-cached, runs test in all packages
```

The `--passWithNoTests` flag is in the script so "no test files found" is not an error. Remove it once you have actual tests.

## Version pin

Vitest is pinned to **v3** (`^3.2.4`), not v4. Vitest 4 requires Vite 7, but we are on Vite 5 for plugin compatibility (notably `vite-plugin-checker` and several others that haven't caught up to Vite 7 yet). When the ecosystem stabilizes on Vite 7, we'll bump Vitest alongside.

## What we do NOT use

- **Jest** — Vitest is strictly better for Vite-based apps (same transform, native ESM, faster)
- **jsdom** — happy-dom is faster for the subset of features we need
- **Enzyme** — deprecated, not recommended for React 18+
- **Playwright for unit tests** — Playwright is reserved for E2E and visual testing
