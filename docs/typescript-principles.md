# TypeScript principles

Industry best-practices for writing modern, maintainable TypeScript. Compiled from the TS handbook, Total TypeScript (Matt Pocock), tRPC / Zod / TanStack conventions, and production patterns used at Vercel, Shopify, Stripe.

The single goal: **make invalid states unrepresentable, push errors from runtime to compile time, never lie to the type system.**

If you reach for `any`, `!`, or `as`, re-read this doc first — there is almost always a safer construct.

---

## 0. Cheat sheet

| Do                                                   | Don't                                     |
| ---------------------------------------------------- | ----------------------------------------- |
| `z.infer<typeof Schema>`                             | Hand-write a shape a schema already has   |
| User-defined type guard `x is Foo`                   | `x as Foo`                                |
| Discriminated union + exhaustive `switch` on `never` | Boolean flags + optional fields           |
| `as const` + `(typeof X)[number]`                    | Hand-written literal unions               |
| `satisfies T` on literal data                        | `: T` (loses narrowing) or `as T`         |
| `unknown` at edges → narrow with Zod                 | `any`                                     |
| Generics with `extends` constraints                  | Function overloads when a constraint fits |
| `readonly T[]` in contracts                          | Mutable `T[]` in public APIs              |
| Branded types for IDs                                | Raw `string` for IDs across layers        |
| `asserts val is NonNullable<T>`                      | Casts after a null check                  |
| Utility types (Pick/Omit/Partial/...)                | Handwritten subset types                  |
| `unknown` catch variables                            | `any` catch (default is now `unknown`)    |

---

## 1. The three you avoid: `any`, `!`, `as`

- **`any`** disables checking on that expression and poisons anything touching it. Prefer `unknown` at boundaries and narrow.
- **`!` (non-null assertion)** silences a real possibility. Use a type guard, assertion function, or discriminated union. Tolerated only at framework contract points (`document.getElementById("root")!`) and only because the runtime guarantee is documented.
- **`as`** is a lie to the compiler. Legitimate uses:
  1. `as const` — literal-type narrowing.
  2. Narrowing `unknown` inside a parse function that's about to validate.
  3. Inside a `satisfies` / user-defined guard body that holds the invariant.

Outside those, rewrite.

```ts
// ❌
const user = data as User;
user.email.toLowerCase(); // crashes if data wasn't a User

// ✅
const user = UserSchema.parse(data);
user.email.toLowerCase();
```

---

## 2. User-defined type guards — the `is` predicate

A function whose return type is `param is SomeType` narrows the caller's variable automatically. Prefer this over scattered `as` casts.

```ts
type Fish = { swim: () => void };
type Bird = { fly: () => void };

function isFish(pet: Fish | Bird): pet is Fish {
  return (pet as Fish).swim !== undefined;
}

function move(pet: Fish | Bird) {
  if (isFish(pet)) {
    pet.swim(); // pet: Fish
  } else {
    pet.fly(); // pet: Bird
  }
}
```

The `as Fish` inside the guard body is acceptable — the runtime check on the next line guards it. Callers stay clean.

**Even cleaner** when you have a known set of values: use `Array.find` and let TS infer.

```ts
const COLORS = ["red", "green", "blue"] as const;
type Color = (typeof COLORS)[number];

const input: string = "red";
const color = COLORS.find((candidate) => candidate === input); // Color | undefined
if (color) {
  // color: Color — no casts
}
```

---

## 3. Discriminated unions + exhaustive `switch`

Every variant carries a literal discriminant (`kind` / `type` / `status` — pick one project-wide). TS narrows on the discriminant alone; extra `as` is never needed.

```ts
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; side: number }
  | { kind: "rectangle"; width: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.side ** 2;
    case "rectangle":
      return shape.width * shape.height;
    default: {
      const _exhaustive: never = shape;
      return _exhaustive;
    }
  }
}
```

Add a fourth variant and `_exhaustive: never = shape` fails to compile at every site. The type system forces you to handle it.

**Anti-pattern**: booleans + optional fields for variants. The `?` means "might exist", which forces consumers into `if (x.foo)` everywhere:

```ts
// ❌ mutually-exclusive fields modeled as optional
type Response = {
  success: boolean;
  data?: User;
  error?: string;
};

// ✅ discriminated — either data or error, never both
type Response = { success: true; data: User } | { success: false; error: string };
```

---

## 4. `satisfies` — validate without widening

`satisfies T` checks conformance to `T` while preserving the inferred narrow type. Use on config, lookup tables, literal data.

```ts
type Color = "red" | "green" | "blue";
type RGB = [r: number, g: number, b: number];

const palette = {
  red: [255, 0, 0],
  green: "#00ff00",
  blue: [0, 0, 255],
  // platypus: "purple"  ❌ Error — not a Color
} satisfies Record<Color, string | RGB>;

palette.green.toUpperCase(); // ✅ green is still `string`, not widened
palette.red.at(0); // ✅ red is still `RGB`
```

With `: Record<Color, string | RGB>` you would lose the per-key narrowing. With `as Record<Color, string | RGB>` you would lose the typo check. `satisfies` gives you both.

---

## 5. `as const` — literal types for free

```ts
const point = [3, 4] as const; // readonly [3, 4]
const role = "admin" as const; // "admin" (not string)
const config = { theme: "dark" } as const; // { readonly theme: "dark" }
```

Lift array values into a type union:

```ts
const ROLES = ["admin", "editor", "viewer"] as const;
type Role = (typeof ROLES)[number]; // "admin" | "editor" | "viewer"
```

Now `ROLES` is iterable at runtime (for UI dropdowns, validation) and `Role` is the compile-time union. One source of truth; add a new role, every switch and prop type updates automatically.

---

## 6. Generics — reuse with constraints

A generic is a type parameter, not `any`. Constrain it with `extends` so misuse is caught at call sites.

```ts
// ❌ no constraint — caller can pass nonsense keys
function pick<T, K>(obj: T, keys: K[]): unknown {
  /* ... */
}

// ✅ constrained — keys must be real keys of T
function pick<Obj, Key extends keyof Obj>(obj: Obj, keys: Key[]): Pick<Obj, Key> {
  const result = {} as Pick<Obj, Key>;
  for (const key of keys) result[key] = obj[key];
  return result;
}

pick({ a: 1, b: 2, c: 3 }, ["a", "c"]); // { a: number; c: number }
pick({ a: 1, b: 2, c: 3 }, ["z"]); // ❌ "z" not in keyof obj
```

**Rules of thumb**:

- Name type parameters descriptively (`TValue`, `TKey`, `TPayload`) — not `T`, `U`, `V` for anything non-trivial.
- Constrain. `T` without `extends` is a red flag.
- If the function accepts "anything", it probably wants `unknown` + narrowing, not a free generic.

---

## 7. Utility types — favor built-ins over handwritten shapes

| Utility          | Purpose                                             |
| ---------------- | --------------------------------------------------- |
| `Partial<T>`     | All props optional — useful for PATCH / update DTOs |
| `Required<T>`    | Strip optionality                                   |
| `Readonly<T>`    | Freeze a shape                                      |
| `Pick<T, K>`     | Subset projection                                   |
| `Omit<T, K>`     | Subtract keys                                       |
| `Record<K, V>`   | Object keyed by a union                             |
| `NonNullable<T>` | Strip `null \| undefined`                           |
| `ReturnType<F>`  | Function's return type                              |
| `Awaited<P>`     | Unwrap Promise                                      |
| `Parameters<F>`  | Function args tuple                                 |
| `Extract<T, U>`  | Filter a union                                      |
| `Exclude<T, U>`  | Remove from a union                                 |

Derive, don't duplicate:

```ts
type User = { id: string; email: string; password: string };

type PublicUser = Omit<User, "password">; // ✅ derived
type PublicUser = { id: string; email: string }; // ❌ drifts from User
```

```ts
async function loadUser(id: string) {
  /* ... */
}
type User = Awaited<ReturnType<typeof loadUser>>; // follows the function
```

---

## 8. Branded types — nominal IDs

Structural typing means any two `string`s are interchangeable. For IDs across boundaries (DB / API / UI), a brand prevents cross-mixing:

```ts
declare const brand: unique symbol;
type Brand<T, K extends string> = T & { readonly [brand]: K };

type UserId = Brand<string, "UserId">;
type PostId = Brand<string, "PostId">;

function getUser(id: UserId) {
  /* ... */
}
function getPost(id: PostId) {
  /* ... */
}

const raw = "abc123";
// getUser(raw);         // ❌ string is not UserId
// getPost(someUserId);  // ❌ UserId is not PostId
```

Mint branded values only in a trusted parser:

```ts
import { z } from "zod";

const UserIdSchema = z.string().uuid().brand<"UserId">();
type UserId = z.infer<typeof UserIdSchema>;

export function parseUserId(raw: unknown): UserId {
  return UserIdSchema.parse(raw); // throws on invalid, returns UserId
}
```

Now the type system enforces "you cannot call `getUser` unless you went through `parseUserId`". Use when entity IDs are being mixed up at runtime. Don't brand every string by default.

---

## 9. Template literal types

When a string's structure is load-bearing for safety, encode it.

```ts
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type Endpoint = `/api/${string}`;
type RouteKey = `${HttpMethod} ${Endpoint}`;

const k: RouteKey = "GET /api/users"; // ✅
const k: RouteKey = "FETCH /api/users"; // ❌
```

Union expansion:

```ts
type Module = "user" | "post";
type Action = "created" | "updated" | "deleted";
type EventName = `${Module}.${Action}`;
//                 ^ "user.created" | "user.updated" | ... | "post.deleted"
```

Event-emitter style with inferred payloads:

```ts
type Events<T> = {
  on<K extends string & keyof T>(event: `${K}Changed`, cb: (next: T[K]) => void): void;
};

declare const user: { name: string; age: number } & Events<{ name: string; age: number }>;
user.on("nameChanged", (next) => next.toUpperCase()); // next: string
user.on("ageChanged", (next) => next.toFixed(0)); // next: number
```

Great when patterns multiply; overkill for ad-hoc cosmetic validation.

---

## 10. `readonly` arrays — honesty in contracts

If a function doesn't mutate the input, type the parameter `readonly T[]`. Caller retains mutation guarantees, callee can't accidentally push/splice.

```ts
function sum(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

// values.push(1); // ❌ inside sum — cannot mutate
```

`ReadonlyArray<T>` is the same thing in long form. Combine with `as const` for fully immutable literals:

```ts
const STATUSES = ["pending", "done", "failed"] as const;
// typeof STATUSES === readonly ["pending", "done", "failed"]
```

---

## 11. Assertion functions — `asserts val is T`

When you need a narrowing _statement_ (not a conditional), write an assertion function. Typical use: "assert not null, or throw".

```ts
function assertDefined<T>(value: T, message?: string): asserts value is NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message ?? "Expected value to be defined");
  }
}

const user = users.find((u) => u.id === id);
assertDefined(user); // throws if not found
user.email; // user: User, no `?` no `!`
```

Use sparingly — prefer narrowing via `if` + early return. Assertions are for places where control flow can't naturally handle the absence.

---

## 12. Zod + TS — schema is the source of truth

For anything parsed at a boundary (HTTP body, env var, localStorage, URL param, third-party response), write a Zod schema and `z.infer` the type. Never hand-maintain both.

```ts
import { z } from "zod";

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  age: z.number().int().min(0),
});

type User = z.infer<typeof UserSchema>;

export function parseUser(raw: unknown): User {
  return UserSchema.parse(raw);
}
```

At every ingress: `Schema.parse(raw)`. Inside the system: trust the type. This is how you make `any` genuinely unnecessary.

---

## 13. `unknown` in catch — the safe default

Since TS 4.4 with `useUnknownInCatchVariables`, `catch (e)` infers `e: unknown`. Narrow before use:

```ts
try {
  await doSomething();
} catch (error) {
  // error: unknown
  if (error instanceof Error) {
    logger.error(error.message, { stack: error.stack });
  } else {
    logger.error("Unknown error", { error });
  }
}
```

Never declare `catch (error: any)`. If you need a custom error hierarchy, make each class identifiable (either `instanceof` check, or a `kind` field on the error base class).

---

## 14. Patterns to avoid

- **Enums** (`enum Color { Red, Green }`). Prefer `as const` + `(typeof X)[number]` — enums have quirks (numeric reverse mappings, non-tree-shakeable output, runtime cost). Const objects + literal unions cover every case cleanly. `const enum` is disabled in our `tsconfig`.
- **Namespaces** (`namespace X {}`). ES modules with named exports do the same thing without a TS-specific construct.
- **`object` as a type** — it's too broad (`{}`, arrays, functions). Use `Record<string, unknown>` if you genuinely mean "some object", or a narrower shape.
- **Function type overloads** when a generic constraint fits. Overloads duplicate signatures; generics compose.
- **`!` after optional chaining** (`user.profile?.email!`). The whole point of `?.` is "might be nullish" — `!` defeats it.
- **Typing to the implementation** (inferring from internals). Write the contract first, implement against it.

---

## Further reading

- TypeScript Handbook — Narrowing, Generics, Conditional Types, Template Literal Types: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- Total TypeScript workshops (Matt Pocock) — `typescript.style`, `totaltypescript.com`
- `type-fest` — advanced utility types when built-ins aren't enough (install on-demand, not speculatively)
- tsconfig strictest preset — https://github.com/tsconfig/bases
