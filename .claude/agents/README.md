# Project subagents

This folder contains specialized Claude Code subagents for the monorepo-fullstack project. Each agent has a focused role, a curated toolset, and a system prompt tuned to this codebase.

## How agents work

When Claude Code starts a task, the main agent can delegate specialized work to one of these subagents via the Agent tool. Each subagent:

- Runs in an isolated conversation with its own system prompt
- Has access only to the tools listed in its frontmatter
- Returns a single result message back to the parent
- Does not inherit the parent's conversation history

Subagents are useful for:

- **Scoping context** — the agent only sees what it needs, the parent's context stays clean
- **Domain expertise** — each agent has tuned instructions for its job
- **Tool restriction** — the code-reviewer agent has no Write/Edit (read-only by design)
- **Parallelization** — multiple agents can run concurrently

## Available agents

### Implementation (can Write/Edit code)

| Agent                                                   | Model | When to use                                                                                                                                    |
| ------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [`frontend-engineer`](./frontend-engineer.md)           | opus  | Writing, modifying, or debugging React code in `apps/web` — structure and logic                                                                |
| [`design-engineer`](./design-engineer.md)               | opus  | Visual polish, typography, colors, motion, interaction states, responsive rhythm                                                               |
| [`backend-engineer`](./backend-engineer.md)             | opus  | Writing, modifying, or debugging NestJS + Prisma code in `apps/api` (controllers, services, repositories, guards, modules)                     |
| [`frontend-test-engineer`](./frontend-test-engineer.md) | opus  | Vitest + React Testing Library tests for `apps/web`                                                                                            |
| [`backend-test-engineer`](./backend-test-engineer.md)   | opus  | Vitest + supertest tests for `apps/api` via `createTestApp([modules])` + `@nestjs/testing`                                                     |
| [`refactor-specialist`](./refactor-specialist.md)       | opus  | Cleaning up messy code, removing dead code, simplifying — behavior-preserving                                                                  |
| [`changelog-writer`](./changelog-writer.md)             | opus  | Adding a "what's new" entry to `apps/api/src/scripts/seed-changelog.ts` when a user-visible feature ships end-to-end (uk + en, seed file only) |

### Documentation (can Write/Edit `docs/features/**` only)

| Agent                                                     | Model | When to use                                                                                      |
| --------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------ |
| [`feature-context-curator`](./feature-context-curator.md) | opus  | Writing or updating end-to-end feature docs in `docs/features/<name>.md` — FE↔shared↔BE full map |

### Release & operations (can Write/Edit + run git/gh/docker)

| Agent                                     | Model | When to use                                                                                                                                                                                   |
| ----------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`release-manager`](./release-manager.md) | opus  | Promote/ship `dev` → `stage` → `prod`: release-delta, per-migration data-risk, prod-copy migration pre-flight, commit-tree promotion, CI gates, deploy, health verify. Halts on any red gate. |

### Investigation & review (read-only)

| Agent                                                               | Model | When to use                                                                                                                |
| ------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------- |
| [`frontend-bug-hunter`](./frontend-bug-hunter.md)                   | opus  | Browser/UI bug — reproduce via Playwright, isolate, diagnose root cause                                                    |
| [`backend-bug-hunter`](./backend-bug-hunter.md)                     | opus  | Server-side bug — reproduce via curl + pino logs, isolate, diagnose root cause                                             |
| [`code-reviewer`](./code-reviewer.md)                               | opus  | Generalist diff review before commit — pattern compliance, correctness, cleanup                                            |
| [`frontend-performance-auditor`](./frontend-performance-auditor.md) | opus  | Bundle size, re-renders, web vitals, memory leaks, CLS/LCP issues                                                          |
| [`accessibility-auditor`](./accessibility-auditor.md)               | opus  | WCAG compliance, keyboard nav, ARIA, contrast, focus management                                                            |
| [`seo-auditor`](./seo-auditor.md)                                   | opus  | SSR markup, per-route/locale metadata, hreflang, sitemap/robots, indexability                                              |
| [`security-reviewer`](./security-reviewer.md)                       | opus  | XSS, CSRF, secrets, SQL injection, cookies/CORS/headers, auth/authz, dep CVEs                                              |
| [`migration-reviewer`](./migration-reviewer.md)                     | opus  | Prisma/Postgres migration safety — data loss, destructive DDL, locks, forward-only reversibility                           |
| [`spec-auditor`](./spec-auditor.md)                                 | opus  | Both ends of spec-driven work: PLAN (verify spec vs code, emit `tasks.json`) and VERIFY (diff vs `tasks.json`, gap report) |

### Model policy

- **All agents run on opus** — by project choice, every subagent uses the deepest model regardless of task. Maximum reasoning quality is prioritized over speed and cost.
- If cost becomes a concern, downgrade the lowest-stakes agents (tests, docs, read-only audits) to sonnet first — they tolerate it best.

### How to decide which agent to delegate to

```
Work arrived as a written spec (docs/backend-task-*.md, handed-over ТЗ)?
└── Run the /spec-to-ship chain — spec-auditor (PLAN) → tasks.json → one question block
    → implement slice by slice → per-slice review → spec-auditor (VERIFY) → gates
    ↑ never implement straight from a spec; its file:line claims are stale until verified

Writing new code?
├── Frontend structure/logic → frontend-engineer
├── Frontend visual polish / motion / typography → design-engineer
├── Backend (NestJS + Prisma) → backend-engineer
├── Frontend test (Vitest + RTL) → frontend-test-engineer
├── Backend test (Vitest + supertest + @nestjs/testing) → backend-test-engineer
└── Cleanup → refactor-specialist

Building a new feature end-to-end?
├── 1. backend-engineer adds the endpoint (shared DTO → service → controller → route)
├── 2. frontend-engineer wires the UI (data fetching, state, routing, components)
├── 3. design-engineer refines the visual layer (motion, hierarchy, polish)
└── 4. feature-context-curator writes docs/features/<name>.md with the full end-to-end map
     ↑ combine steps 1–3 when the task is small; step 4 runs automatically after landing

Something is broken?
├── Browser symptom (UI, console, layout, hydration) → frontend-bug-hunter
└── Server symptom (500, endpoint failing, Postgres/query error, server crash) → backend-bug-hunter
   ↑ both investigate read-only, then the appropriate engineer fixes

Reviewing a diff before commit?
├── General review → code-reviewer
├── FE performance concern → frontend-performance-auditor
├── A11y concern → accessibility-auditor
├── SEO / SSR markup concern → seo-auditor
├── Security-sensitive change → security-reviewer
└── Migration / schema change → migration-reviewer
```

You can run multiple review agents in parallel on the same diff — they have non-overlapping concerns.

### Backend performance auditor

There is intentionally no `backend-performance-auditor` agent yet. Per the project's measure-before-optimizing rule, we add it when there is a real measured BE perf problem to investigate (slow endpoints, N+1 queries, memory growth in Node), not preemptively.

## Agent file format

```yaml
---
name: agent-name
description: One-paragraph description of when to use this agent. Claude reads this to decide whether to delegate a task to this agent.
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---
# Role

System prompt body — the agent's instructions.
```

### Fields

- **`name`** — unique identifier, lowercase-kebab-case. Used in the Agent tool's `subagent_type` parameter.
- **`description`** — short description shown when listing agents. The parent Claude uses this to decide delegation.
- **`tools`** — comma-separated list of tool names. Omit for full tool access. Restrict for agents that should be read-only or narrowly scoped.
- **`model`** — `sonnet`, `opus`, or `haiku`. Defaults to the parent's model.

## Rules shared by all agents

Every agent in this folder MUST follow these rules from project memory:

1. **No code comments.** Write self-documenting code. No header blocks, no explanatory `//` lines, no JSDoc on internal functions.
2. **Cursor-pointer on clicks.** Every clickable element must have `cursor-pointer`. Already baked into `Button` and `DropdownMenuItem`, apply to custom click handlers directly.
3. **No wrapper libraries over standard tools.** Use `react-hook-form` + `zod` directly with shadcn primitives. Do not build custom `<Form>` or `<FormField>` abstractions. Generalizes to any standard library — use libraries at the level they were designed for.
4. **Respect the quality gates.** Before marking work as done: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm knip` must all pass.
5. **Follow the code principles.** Every agent must read and apply [`docs/code-principles.md`](../../docs/code-principles.md). Core tenets: names over comments, clarity over cleverness, easy-to-delete over easy-to-extend, make invalid states unrepresentable, pure functions by default. Full list of anti-patterns we reject is in section 9 of that file.
