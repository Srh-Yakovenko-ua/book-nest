---
name: deep-module
description: Vocabulary and tests for deciding where a seam goes and how much behaviour hides behind it. Use when a service has outgrown one responsibility, when deciding whether to extract a helper or a port, when a module is hard to test, and when the user says "разбей сервис", "где граница", "стоит ли выносить", "абстракция", "рефактор архитектуры", "split this".
---

# Deep modules

`CLAUDE.md` says a service over roughly 150 to 200 lines gets split by responsibility. That rule tells you **when** to cut. It does not tell you **where**, and a bad cut produces two shallow modules that are harder to follow than the one long file you started with.

This skill is the vocabulary and the tests for making that call.

## Terms

Use these exactly. Do not substitute "component", "layer", "API", or "boundary" when you mean one of them.

**Module** — anything with an interface and an implementation. Scale-agnostic on purpose: a function, a class, a folder, a whole feature slice.

**Interface** — everything a caller must know to use it correctly. Not just the type signature: also the invariants it assumes, the ordering it requires, the errors it throws, the transaction it must or must not be inside, and what it costs. In this repo, "this repository method takes an optional trailing `client` so a service-owned transaction threads through" is part of the interface, even though the type barely hints at it.

**Implementation** — what is inside.

**Depth** — leverage at the interface: how much behaviour a caller gets per unit of interface they have to learn. **Deep** is a lot of behaviour behind a small interface. **Shallow** is an interface almost as complicated as the body behind it.

**Seam** — a place where you can change behaviour without editing in that place. It is _where the interface lives_, and choosing it is a separate decision from deciding what goes behind it.

**Adapter** — a concrete thing that satisfies an interface at a seam. A role, not a substance.

**Leverage** is what callers get from depth. **Locality** is what maintainers get: bugs, changes and knowledge concentrate in one place instead of spreading across every call site.

## The tests

**The deletion test.** Imagine deleting the module and inlining it everywhere. If complexity vanishes, it was a pass-through and should not exist. If the same complexity reappears in five callers, it was earning its keep. This is the fastest way to kill a proposed abstraction before you write it.

**The interface is the test surface.** Callers and tests cross the same seam. If you find yourself wanting to test _past_ the interface, reaching into internals, the module is the wrong shape. Move the seam rather than exporting the internals.

**One adapter is a hypothetical seam. Two is a real one.** Do not define a port until something genuinely varies across it. `RealtimePort` in this repo earns its port: there is a socket.io adapter and a test fake, and the service knows neither. A "repository interface" with exactly one Prisma implementation and no fake would be pure indirection.

**Accept dependencies, do not construct them.** This is why services take repositories through the constructor and never `new` a Prisma client. It is also why a service must never inject `PrismaService`: that would put the database in its interface.

## Where the seams already are

The layered architecture is a set of pre-agreed seams, and most of the time the right answer is to use them rather than invent a new one:

- **Controller → service.** HTTP stops here. Everything above the seam knows about `req` and status codes; nothing below does.
- **Service → repository.** Prisma stops here. Repositories return rows and primitives, never ViewModels, because a ViewModel would drag presentation across the seam.
- **Service → domain.** Pure functions in `domain/` are the cheapest depth in the codebase: no I/O, no mocks, tested directly. When a service is too long, look here first. Grouping, ranking, progress calculation, status derivation and filter mapping are all things that came out of overgrown services and became small pure modules.

## Splitting an overgrown service

In order:

1. **Pull out the pure parts into `domain/`.** Anything that is a calculation over data you already have. This usually removes a third of the file and all of its hardest tests.
2. **Then split by responsibility, not by size.** A "builder" that shapes one view model and an "assembler" that gathers the pieces are two responsibilities. Two files of the same length cut at an arbitrary line are one responsibility pretending to be two.
3. **Check each half against the deletion test.** If deleting the new module and inlining it makes the code simpler, you cut in the wrong place.
4. **Delete the tests that tested the old internals.** Replace, do not layer. Old unit tests on what is now an implementation detail become waste the moment tests exist at the new interface. Deleting them is correct; leaving them is how a suite starts failing on refactors that broke nothing.

## Designing an interface twice

When the interface really matters and the first idea is probably not the best one, design it more than once before committing. Sketch two or three genuinely different shapes, not variations of one:

- minimise the interface: one or two entry points, maximum leverage each
- optimise the common caller: make the default case trivial, the rare case possible
- ports and adapters: if the dependency crosses a network or a vendor you do not control

Then compare them on depth, locality and seam placement, and pick one with a stated reason. If that reason was a real trade-off and it will be hard to reverse, it is an ADR: run `/domain-model`.
