# Claude Code setup

Everything the Claude Code setup for book-nest depends on lives in this repository. After `git clone` you install a few command line tools and three plugins, approve two MCP servers, and start every session from the repo root.

## Start from the repo root

Run `claude` in the repository root, not in `apps/api` or `apps/web`. Claude Code reads `.claude/settings.json` only from the directory a session starts in. A session started in a subdirectory still loads `CLAUDE.md` and the skills, so it looks configured, but no hook runs and no permission rule applies. Run `/hooks` once at the start: if it lists nothing from the project, restart from the root.

## What the repo carries

| Path                    | What it holds                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`             | Architecture, conventions and the rules every session follows.                                                |
| `.claude/agents/`       | The subagents work gets routed to, such as `backend-engineer` and `security-reviewer`.                        |
| `.claude/skills/`       | The slash commands: `/check`, `/diagnose`, `/fix-loop`, `/spec-to-ship`, `/unlazy`, `/blast-radius` and more. |
| `.claude/hooks/`        | Guards on shell commands and file edits, the post-edit checks, and the commit gate for security-shaped files. |
| `.claude/scripts/`      | `gates.sh` for the local gates, `security-shaped.sh`, and `test-hooks.sh` with the hook fixtures.             |
| `.claude/rules/`        | Rules that load when you open matching files, such as the migration traps.                                    |
| `.claude/settings.json` | Hook wiring, permission rules and plugins.                                                                    |
| `.mcp.json`             | The MCP servers: Context7 and Mailtrap.                                                                       |

None of these files hold a key. The MCP servers read theirs from your shell environment.

## Command line tools

The hooks are bash scripts. They need `git`, `jq`, `node` and `perl` on your `PATH`. The skills that touch CI and the local database also use `gh` and `docker`, and the optional UX lookup uses `python3`. On macOS, `brew install jq gh` covers what Node and Docker Desktop do not.

Check the hooks with their self-test. It feeds each hook its fixtures and ends with a passed and a failed count, and failed should be 0:

```
bash .claude/scripts/test-hooks.sh
```

## Plugins

`.claude/settings.json` enables two plugins from Anthropic's official marketplace, `playwright` and `chrome-devtools-mcp`. Project settings enable a plugin but do not download it, so on a fresh machine `/plugin` lists both under Errors. Install them once:

```
claude plugin install playwright@claude-plugins-official --scope project
claude plugin install chrome-devtools-mcp@claude-plugins-official --scope project
```

Then run `/reload-plugins` in the session.

The third one is optional. The `design-engineer` agent looks up UX guidelines through `.claude/scripts/ux-lookup.sh`, which reads the database of the community plugin `ui-ux-pro-max`. The repo registers its marketplace and keeps the plugin itself disabled, because its own skill gives advice that conflicts with `CLAUDE.md` (raw hex colors, memoization by default). Only the data gets used, and only through the script. It runs a Python script from a third party repository, so read it before you install:

```
claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill
```

Without it the lookup prints a notice and the agent carries on.

Browser checks in this repo go through the Claude in Chrome extension rather than a configured server. Install it if you will touch the UI.

## MCP servers

Claude Code asks you to approve each server in `.mcp.json` the first time it starts.

Context7 fetches current library documentation. `CLAUDE.md` requires it before writing code against any library, and most agents call it. It works without a key. A free key from [context7.com/dashboard](https://context7.com/dashboard), exported as `CONTEXT7_API_KEY` in your shell, raises the rate limit. The version is pinned so that a compromised release does not run on every contributor's machine at the next session start. Bump it by hand, to a release that is at least two weeks old.

Mailtrap reads and sends test email through the Mailtrap API. It needs `MAILTRAP_API_TOKEN` and `MAILTRAP_ACCOUNT_ID` in your shell. Without them it shows as invalid in `/mcp` and everything else keeps working.

## What stays on your machine

Some Claude Code state is personal on purpose.

Auto memory in `~/.claude/projects/<repo-path>/memory/` is written per developer. The maintainer's copy holds server and incident details that a public repository should not carry. A rule that should bind every contributor goes into `CLAUDE.md` or a skill, never only into memory.

`.claude/settings.local.json` holds your own permission approvals, and git ignores it.

A personal skill in `~/.claude/skills/` wins over a project skill with the same name. If `/unlazy` or `/check` behaves differently for you than the file in `.claude/skills/` says, look there first.

## Checking the setup

In a session started from the root, `/hooks` should list the project hooks, `/plugin` should show `playwright` and `chrome-devtools-mcp` as installed, and `/mcp` should show `context7` connected.
