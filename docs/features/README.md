# Feature map

One document per feature — end-to-end context, file:line references, data flow from user click to rendered result. Maintained by the `feature-context-curator` agent.

## How to read a feature doc

Every entry here points to a file that contains, for one feature:

- Purpose and user-visible behavior
- End-to-end data flow (click → hook → HTTP → controller → service → model → response → cache → re-render)
- HTTP API surface (methods, paths, status codes, Zod schemas)
- Backend layers touched (routes / controllers / services / models / middleware)
- Shared contracts (`@app/shared` DTOs consumed by both sides)
- Frontend slice (`api.ts`, hooks, components, pages, routes, state)
- Observable states (idle / loading / empty / error / success)
- Tests that cover it
- Known gaps and TODOs

All concrete claims use `path:line` references so the reader can click straight into the code.

## Active

- [blogs-posts](./blogs-posts.md) — full-stack blogs + posts with modal-only UX, TanStack Query, BE CRUD + 33 integration tests (active)
- [blogs-posts-videos](./blogs-posts-videos.md) — BE-only reference for all three resources including videos; 55 integration tests; superseded by blogs-posts.md for FE sections (active)

## Planned

- (none yet)

## Deprecated

- (none yet)

## Related docs

- [Architecture](../architecture.md) — folder layout and decision table
- [Patterns](../patterns.md) — how to add a feature, write forms, fetch data
- [Code principles](../code-principles.md) — how to write code
