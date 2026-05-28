# MCP servers & Claude Code plugins

## What they are

[Model Context Protocol](https://modelcontextprotocol.io) (MCP) is an open standard for connecting AI coding assistants to tools and data sources. In Claude Code, MCP servers extend what Claude can do by exposing new tools at runtime — browser automation, documentation lookup, database access, and so on.

Claude Code also has **plugins** distributed through official and community marketplaces. Plugins can bundle skills, agents, commands, and MCP servers into a single installable unit.

## Servers and plugins we use

### 1. `frontend-design` skill (official plugin)

Published in the `claude-plugins-official` marketplace. Installs a single **skill** that makes Claude generate production-grade frontend code with distinctive typography, cohesive color systems, and intentional layout — avoiding generic "AI slop" aesthetics.

**Install:**

```
/plugin install frontend-design@claude-plugins-official
/reload-plugins
```

**What it does:** activates automatically whenever Claude is asked to build UI. Informs styling decisions (fonts, color palettes, layouts, animations) so output has character.

**What it does NOT do:** it's not a component library and doesn't install any runtime code. Pure prompt-level guidance for Claude.

### 2. `playwright` MCP (official plugin)

Microsoft's official Playwright MCP, published in `claude-plugins-official`. Exposes ~25 tools for browser automation.

**Install:**

```
/plugin install playwright@claude-plugins-official
/reload-plugins
```

**What it gives Claude:**

- `browser_navigate`, `browser_navigate_back`
- `browser_click`, `browser_type`, `browser_fill_form`
- `browser_take_screenshot` (viewport or full page)
- `browser_snapshot` (accessibility tree of the page — faster than screenshot for reading state)
- `browser_console_messages` (read browser console)
- `browser_evaluate`, `browser_run_code` (execute JS in page context)
- `browser_wait_for`, `browser_press_key`
- `browser_resize` (viewport control)

**How we use it:** Claude generates a UI change, then opens `http://localhost:5173/` in Playwright's controlled Chromium, takes a screenshot, reads the DOM, verifies it renders as expected. Closes the feedback loop without manual checking.

### 3. `context7` MCP (community, by Upstash)

Fetches **up-to-date library documentation** on demand. Claude's training data has a cutoff; by the time libraries like React Router, TanStack Query, Tailwind, or Vite change their APIs, Claude might not know. Context7 pulls current docs directly from the library's repository.

**Install (from terminal, not as a slash command):**

```bash
claude mcp add context7 -- npx -y @upstash/context7-mcp --api-key YOUR_API_KEY
```

API key is optional; unauthenticated access has lower rate limits. Get a free key at [context7.com/dashboard](https://context7.com/dashboard).

**Tools exposed:**

- `mcp__context7__resolve-library-id` — search for a library by name, returns its canonical Context7 ID
- `mcp__context7__query-docs` — fetch documentation for a specific topic within a resolved library

**How we use it:** before writing non-trivial code with a library we haven't touched in a while, Claude queries Context7 for the current API surface. This prevents drift between what Claude "remembers" and what the library actually supports.

## Verifying what's loaded

Run `/mcp` inside Claude Code to see the list of active MCP servers.

## Why these three specifically

- **frontend-design** — improves the quality of UI Claude generates. Zero runtime cost.
- **playwright** — closes the visual feedback loop. Without it, Claude is flying blind when making UI changes.
- **context7** — keeps Claude's library knowledge current. Without it, Claude might use deprecated APIs.

Together they enable the workflow: "Claude changes code → opens the page → verifies what rendered → queries docs if something is unfamiliar → iterates".

## Intentionally not installed

| Not using             | Why                                                                    |
| --------------------- | ---------------------------------------------------------------------- |
| `chrome-devtools-mcp` | Installed but didn't activate; `playwright` covers the same capability |
| `stagehand`           | Overlaps with Playwright                                               |
| `figma` MCP           | No Figma designs to read yet                                           |
| `sentry` MCP          | No Sentry account yet                                                  |
| `postgresql` MCP      | Using MongoDB in phase 1                                               |
| `mongodb` MCP         | Not set up yet; will consider when we have a running Mongo instance    |

## Relationship to the project code

MCP servers and Claude Code plugins are **per-user configuration**, not part of the project source tree. They live in `~/.claude/` on each developer's machine. They do not affect builds, tests, or runtime behavior of the app. They only change what Claude can do when asked to work on this codebase.

Documenting them here is still useful because:

- Anyone cloning the repo benefits from knowing which tools were assumed during development
- The workflow patterns (Claude verifies UI via Playwright, fetches current docs via Context7) are part of how this codebase is maintained
