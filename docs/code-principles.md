# Code principles

The rules we use to write code in this repository. Not a tutorial — a reference.

Applied by every agent in `.claude/agents/` and by human contributors. When a principle conflicts with another, the higher one on this page wins.

---

## 0. Top-level philosophy

### 0.1 Names over comments

Good names make comments unnecessary. If you feel the urge to write a comment, rename the thing instead. This repository forbids code comments by project rule — rename until the code explains itself.

**Bad**

```ts
// calculate user age from birth year
function calc(u: User): number {
  return 2026 - u.y;
}
```

**Good**

```ts
function getUserAge(user: User): number {
  return CURRENT_YEAR - user.birthYear;
}
```

### 0.2 Clarity over cleverness

A senior writes code that a junior can read. Reach for cleverness only when a simpler version is demonstrably worse (measured, not guessed).

### 0.3 Easy to delete > easy to extend

Code that's easy to delete is easy to change. Avoid building "frameworks" and abstractions that lock you in. Three similar lines are better than a premature helper.

### 0.4 Make invalid states unrepresentable

Use the type system to rule out bugs instead of checking for them at runtime. Discriminated unions, branded types, and readonly data are your tools.

### 0.5 Pure functions by default, side effects at the edges

Business logic should be pure functions of input → output. Side effects (IO, state, DOM) live at the edges of the system: controllers on the server, components on the client.

---

## 1. Naming

- **Use full, descriptive names.** `getUserAge` over `calcAge`. `notesApi.list` over `notesApi.getAll`.
- **Boolean names are questions.** `isLoading`, `hasError`, `canEdit`, not `loading` or `error` for booleans.
- **Avoid negations.** `isEmpty` over `isNotFull`. Double-negative conditions (`!isNotX`) are a source of bugs.
- **Collections are plural.** `users`, not `userList` or `arrUsers`.
- **Constants in UPPER_SNAKE only at module scope** for true constants. Everything else is `camelCase`.
- **Component names are PascalCase and nouns.** `NoteForm`, `HealthPage`. Not `RenderNotes`.
- **Hook names start with `use`.** `useNotes`, `useCreateNote`.
- **Event handlers start with `on` (prop) or `handle` (local).** `onSubmit` is the prop, `handleSubmit` is the local function.

---

## 2. Function design

### 2.1 One concern per function

A function should do one thing. If you find yourself writing `and` in the name, split it.

### 2.2 Keep argument count low

**1–2 args**: fine. **3 args**: maybe rethink. **4+ args**: **always use an options object** and name them.

```ts
renderChart(data, "line", { width: 800, height: 400 }, true, false); // ❌
renderChart(data, { kind: "line", width: 800, height: 400, responsive: true, animated: false }); // ✅
```

### 2.3 Avoid boolean parameters

A boolean arg at a call site tells you nothing about what `true` means. Use an enum, a union string, or a config object.

```ts
sort(users, true); // ❌ sort by what? ascending or descending?
sort(users, { by: "name", order: "asc" }); // ✅
```

### 2.4 Early return over nested if

```ts
function getFee(user: User): number {
  if (!user.isActive) return 0;
  if (user.isTrial) return 0;
  if (user.isAdmin) return 0;
  return computeFee(user);
}
```

Not

```ts
function getFee(user: User): number {
  let fee = 0;
  if (user.isActive) {
    if (!user.isTrial) {
      if (!user.isAdmin) {
        fee = computeFee(user);
      }
    }
  }
  return fee;
}
```

### 2.5 Return data, not undefined

Prefer empty arrays, null objects, or typed results over `undefined`. Missing data should be a deliberate signal, not an ambient one.

### 2.6 Pure by default, async at the boundary

Keep pure transforms separate from IO. It makes both easier to test.

```ts
function formatReport(entries: Entry[]): string {
  /* pure */
}
async function fetchAndFormatReport(): Promise<string> {
  const entries = await loadEntries();
  return formatReport(entries);
}
```

---

## 3. TypeScript design

### 3.1 Infer inside, annotate at boundaries

- **Annotate public function signatures**, exported types, and public API.
- **Let inference work inside functions** for locals. Don't over-type.

```ts
export function getUserAge(user: User): number {
  // annotated
  const currentYear = new Date().getFullYear(); // inferred
  return currentYear - user.birthYear;
}
```

### 3.2 No `any`. No `!`. Minimal `as`.

- `any` defeats the type system. Use `unknown` if you genuinely don't know, then narrow.
- Non-null assertion `!` is a liability. Narrow with `if (x)` or use optional chaining.
- Type assertion `as X` is OK only when you know more than the compiler and can prove it.

### 3.3 Discriminated unions over multiple optionals

**Bad**

```ts
type FetchState<T> = {
  isLoading: boolean;
  error?: Error;
  data?: T;
};
```

**Good**

```ts
type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; data: T };
```

The good version makes invalid states (loading + error + data) impossible to represent.

### 3.4 Exhaustive switches with `never`

```ts
function assertNever(x: never): never {
  throw new Error(`Unexpected: ${JSON.stringify(x)}`);
}

function format(state: FetchState<string>): string {
  switch (state.status) {
    case "idle":
      return "";
    case "loading":
      return "Loading…";
    case "error":
      return state.error.message;
    case "success":
      return state.data;
    default:
      return assertNever(state);
  }
}
```

Adding a new variant to `FetchState` now fails to compile until you handle it.

### 3.5 `as const` and `satisfies`

```ts
const ROUTES = {
  home: "/",
  notes: "/notes",
  login: "/login",
} as const satisfies Record<string, string>;
```

`as const` narrows to literal types; `satisfies` validates the shape without widening.

### 3.6 Readonly where possible

```ts
function sum(numbers: ReadonlyArray<number>): number {
  return numbers.reduce((a, b) => a + b, 0);
}
```

Prevents accidental mutation inside the function.

### 3.7 Branded types for IDs

```ts
type NoteId = string & { readonly brand: unique symbol };
type UserId = string & { readonly brand: unique symbol };
```

Now `getNote(userId)` is a type error — you can't accidentally pass the wrong kind of ID.

### 3.8 `type` by default, `interface` for declaration merging

Default to `type` aliases. Use `interface` only when you need declaration merging (rare — usually only for augmenting third-party types).

### 3.9 Parse at the boundary, trust inside

Use Zod at HTTP and storage boundaries to turn `unknown` into typed data. Inside, trust the types.

```ts
const NoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

async function getNote(id: string): Promise<Note> {
  const raw = await request(`/api/notes/${id}`);
  return NoteSchema.parse(raw); // runtime validation at the edge
}
```

---

## 4. React component design

### 4.1 Small, focused components

One component should render one thing. When a component file passes ~200 lines or has more than 3 distinct sections, split it.

### 4.2 Colocation

Put state as close as possible to where it is used. Lift only when two or more components need the same data.

### 4.3 Derived state in render, not in `useState`

```tsx
const [items, setItems] = useState<Item[]>([]);
const total = items.reduce((sum, i) => sum + i.price, 0); // derived
```

Not

```tsx
const [items, setItems] = useState<Item[]>([]);
const [total, setTotal] = useState(0);
useEffect(() => setTotal(items.reduce(...)), [items]);  // ❌ stored derived state
```

### 4.4 Effects for side effects only

`useEffect` is for synchronizing with external systems (DOM, subscriptions, timers). It is **not** for:

- Data fetching → use TanStack Query
- Derived state → compute in render
- Event handling → event handlers

### 4.5 Custom hooks for reusable stateful logic

If two components need the same piece of stateful logic, extract it into a `useX` hook. The hook returns data and actions, the components render.

### 4.6 Avoid prop drilling deeper than 2 levels

Three levels of "pass it through" is a smell. Use a Zustand store, React context, or a wrapping component with children.

### 4.7 Composition over props

Prefer children and slot props over boolean "mode" props.

```tsx
<Card title="Health" action={<RefreshButton />}>...</Card>                // ✅
<Card title="Health" hasRefreshButton onRefresh={refetch}>...</Card>      // ❌
```

### 4.8 Memoize only when measured

`useMemo` and `useCallback` have a real cost (memory + dependency checks). Apply them only when profiling shows a measurable win. Premature memoization makes code noisier without helping.

### 4.9 Keys are identity, not order

List keys must uniquely identify the item across re-renders. Use `id`, not `index`, unless the list is static and immutable.

### 4.10 Event handler naming

- **Prop** passed to a component: `onSubmit`, `onClick`, `onChange`
- **Local handler** inside a component: `handleSubmit`, `handleClick`, `handleChange`
- If the handler passes the event directly, you often don't need a wrapping function: `<button onClick={onClick}>` not `<button onClick={(e) => onClick(e)}>`

---

## 5. State management — where does this state live?

A decision tree:

1. **Is it derived from props or other state?** Compute it in render. No hook needed.
2. **Is it used in one component only?** `useState` in that component.
3. **Is it used by a parent and its direct child?** Lift to the parent, pass down.
4. **Is it used in multiple unrelated components?** Zustand store.
5. **Is it server data (from an API)?** TanStack Query. Never put server data in `useState` or Zustand.
6. **Is it a form's state?** `react-hook-form`. Never `useState` for form fields.
7. **Is it URL state?** `useSearchParams` from React Router. Never duplicate in local state.

Rule: **one source of truth per piece of state**. If you find yourself syncing state across hooks, you have two sources — pick one and derive from it.

---

## 6. Error handling

### 6.1 Fail fast at boundaries

Validate input at the edge of the system (HTTP, storage, user input). Inside business logic, trust the types.

### 6.2 Typed errors over messages

```ts
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
```

Callers check `err instanceof ApiError && err.status === 401`, not `err.message.includes("Unauthorized")`.

### 6.3 Never swallow errors

`catch` without either re-throwing or logging is almost always a bug. At minimum, log via `createLogger(scope).error(...)`.

### 6.4 Error boundaries catch render errors, not async errors

React's Error Boundary catches errors during render. It does **not** catch `setTimeout`, `fetch().catch`, or `onClick` errors. For those, use `window.addEventListener("error")` and `"unhandledrejection"` — already set up in `lib/error-handlers.ts`.

---

## 7. Decomposition

### 7.1 One concern per file

A file should have one focused purpose. Multiple unrelated exports from one file is a smell.

### 7.2 When to extract

Extract a helper when:

- The logic is genuinely reused in 2+ places
- The logic has a name that makes the call site clearer
- The logic is pure and testable in isolation

Do **not** extract when:

- The helper has only one caller
- The helper only exists because "the function is long"
- Extracting would require threading context through awkward arguments

### 7.3 Depth over breadth

A deeply nested folder structure is usually better than a wide flat one. Prefer `features/notes/components/note-list/item.tsx` over `features/notes/note-list-item.tsx` if the component is complex.

### 7.4 Barrel files only for feature public API

`features/<name>/index.ts` is fine — it's the feature's public API. Do **not** create `components/index.ts` or `hooks/index.ts` unless there's a specific reason. Barrel files defeat tree-shaking and make imports less precise.

---

## 8. Tests

- **Test behavior, not implementation.** Assert on what the user sees, not on internal state.
- **Prefer `getByRole` and `getByLabelText`** over `getByTestId`.
- **One assertion group per test.** If a test has "and then" sections, split it.
- **Name tests as sentences.** `test("shows error when submit fails")`, not `test("error case")`.
- **Use `renderWithProviders` / `renderWithRouter`** from `@/test-utils`, never raw `render`.
- **Mock at the network boundary** (fetch), not at the hook level.
- See [`docs/tools/vitest.md`](./tools/vitest.md) for specifics.

---

## 9. Anti-patterns we explicitly reject

| Anti-pattern                                  | Why                                                        |
| --------------------------------------------- | ---------------------------------------------------------- |
| Code comments                                 | Rename until the code is self-documenting                  |
| Wrapper libraries over standard tools         | Use react-hook-form, zod, TanStack Query, Zustand directly |
| `any` type                                    | Defeats the type system                                    |
| Non-null assertion `!` without justification  | Hides null bugs                                            |
| `useState` for derived state                  | Compute in render                                          |
| `useEffect` for data fetching                 | Use TanStack Query                                         |
| `useMemo` / `useCallback` without measurement | Premature optimization                                     |
| Deep prop drilling                            | Use context or Zustand                                     |
| Boolean function parameters                   | Use enums or objects                                       |
| 4+ positional arguments                       | Use a single options object                                |
| Magic numbers/strings in logic                | Extract to named constants                                 |
| Barrel `index.ts` everywhere                  | Only for feature public API                                |
| Classes in React components                   | Use function components + hooks                            |
| Utility "base classes"                        | Compose functions instead                                  |
| DRY applied too early                         | Three similar lines > premature abstraction                |
| "Just in case" abstractions                   | YAGNI — wait for real need                                 |
| Generic `Helper`, `Utils`, `Manager` names    | Say what it actually does                                  |
| Mutating function arguments                   | Return a new value                                         |
| Returning `undefined` by default              | Return empty array / null object / typed result            |

---

## 10. When to break these rules

A senior knows when a rule is wrong for a situation. All of the above are defaults, not laws. Break a rule when:

- The alternative is clearly worse (measured, not hypothesized)
- The code would become harder to read by following the rule
- An external constraint (a library's API, a performance requirement) forces your hand

When you break a rule, **make the reason obvious** — through a clearly-named function, a test that documents the case, or a commit message that explains.

Do **not** leave a code comment to explain the deviation. Names, tests, and commit history are the documentation.
