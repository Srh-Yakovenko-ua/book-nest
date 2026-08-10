---
name: wizard
description: Generate an interactive bash wizard that walks a human through the steps only they can do — clicking a dashboard, revealing a key, approving a DNS record, entering a password. Use when provisioning infrastructure, wiring credentials or CI secrets, walking an unfamiliar third-party console, or running a one-off cutover, and when the user says "не могу сам", "нужен доступ", "настрой мне", "проведи по шагам", "setup script". Not for steps you can perform yourself.
---

# Wizard

There is a class of work in this project that you are structurally unable to finish: the steps that need a human at a browser with a password manager. Provisioning on Hetzner. Revealing an R2 access key. Approving a Cloudflare Access policy. Adding a DNS record. Creating an email alias. Typing an admin password into a macOS dialog. Every time one of these comes up, the work stalls, gets explained in chat, half-done, and re-explained next month.

A **wizard** is the fix: a bash script that opens each URL, says exactly what to click and copy, captures the value, writes it where it belongs, confirms before anything irreversible, and shows how many stages are left.

The UX is already solved by [template.sh](template.sh). Your job is only to scope the procedure and author its stages. Everything above the `STAGES` marker is the library and is identical in every wizard. Never hand-edit it.

A wizard is ephemeral by default: write it to the session scratchpad, run it, delete it. Commit it to `scripts/` only when the user wants a repeatable setup path that should live in the repo.

## Process

### 1. Scope the procedure

Work out every manual step and every value captured along the way. Read the repo first, do not ask cold:

- `.env`, `.env.example`, `apps/api/src/config/env.ts` and `apps/web/src/lib/env.ts` (the Zod schemas are the real list of required variables)
- `docker-compose.yml`, `docker-compose.prod.yml`
- `.github/workflows/*` — every `secrets.*` and `vars.*` reference is a value the wizard must produce
- for a cutover: the current state, the target state, and the irreversible actions between them

Then show the user the ordered list of stages and the values each produces, and confirm. They may add, drop, or reorder.

**Done when** every stage is named in order, and for each captured value you know where the human gets it, where it is written (`.env`, a GitHub secret, both, or nowhere for a pure action stage), and whether it is secret.

### 2. Map each stage's journey

Write the precise path: which URL, what to do there, where the value appears, which variable it fills. "Cloudflare dashboard → R2 → Manage API tokens → Create token → copy the Secret Access Key, it is shown once."

Where you do not actually know the current UI or the exact command, **say so and ask, or check the docs**. A wizard that invents a menu item that does not exist is worse than no wizard, because the human trusts it and then gets lost.

**Done when** every stage traces to instructions a stranger could follow.

### 3. Author it

Copy `template.sh` to the target path. Replace the example stage with one `stage` per step in dependency order. Set `TOTAL_STAGES`.

Library helpers: `stage`, `say` / `step` / `note` / `warn`, `open_url`, `ask` / `ask_secret`, `write_env`, `set_secret` / `set_var`, `pause` / `confirm`, `finish`.

Hold the bar the template sets:

- open the URL **before** asking for the value it produces
- `ask_secret` for anything secret, so it never echoes to the terminal and never lands in scrollback
- `write_env` every persisted value; `set_secret` only what CI actually reads
- `confirm` before anything irreversible
- one focused task per stage, because each `stage` clears the screen and anything the human still needs must not have scrolled away

### 4. Verify and hand off

```bash
bash -n <script>
shellcheck <script>        # if available
chmod +x <script>
```

Do **not** run it end to end yourself. It opens browsers and blocks on human input. Trace it statically instead: every value from step 1 is captured and lands where step 1 said it would, and every `set_secret` name matches a `secrets.*` reference in a workflow exactly.

Then tell the user how to run it, in one line they can paste.

## Rules for this project

- **Never print a secret back.** Not in the script's output, not in your summary, not in a commit. `<REDACTED>` in any report.
- **Never write a real `.env`.** A PreToolUse hook blocks you from editing `.env` files directly, and that block is correct. The wizard writes them at runtime, as the human, which is the whole point.
- **Mutating database steps target local Docker on `:5432` only.** A wizard that touches the server databases on `:5532` / `:5533` needs the user to say so explicitly, in that turn.
- **Do not commit an ephemeral wizard.** A one-off provisioning script in git rots into a trap that describes a console that has since been redesigned.

## Attribution

`template.sh` is vendored from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
