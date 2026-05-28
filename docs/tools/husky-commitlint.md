# Husky + lint-staged + commitlint

## What they are

Three tools that work together to enforce quality gates on every git commit:

- [**husky**](https://typicode.github.io/husky/) — installs git hooks from `.husky/` into your local `.git/hooks/`
- [**lint-staged**](https://github.com/lint-staged/lint-staged) — runs commands against **only** the files you have staged, not the whole repo
- [**commitlint**](https://commitlint.js.org) — validates commit messages against a rule set (we use Conventional Commits)

## Why we have them

- **Nothing broken lands in the repo** — can't commit code that fails ESLint or Prettier
- **Fast** — `lint-staged` only runs against the files in your commit, not the whole tree
- **Consistent commit history** — `commitlint` blocks non-conventional messages, so `git log` stays clean and machine-readable
- **Automatic changelog potential** — conventional commits are the foundation for auto-generated changelogs and semantic versioning (when we want them)

## Installation

Husky is installed automatically on `pnpm install` via the `prepare` script in the root `package.json`:

```json
{
  "scripts": {
    "prepare": "husky"
  }
}
```

Running `prepare` creates `.husky/_/` with husky's shim scripts and installs the hooks into `.git/hooks/`.

## Hook 1 — `.husky/pre-commit`

```sh
pnpm exec lint-staged
```

Triggers when you run `git commit`. Runs `lint-staged`, which reads its config from the root `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx,mjs,cjs}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml,css,html}": ["prettier --write"]
  }
}
```

Flow:

1. git collects staged files
2. lint-staged groups them by extension
3. For code files: runs `eslint --fix` first, then `prettier --write`
4. For data/markup: runs `prettier --write` only
5. The auto-fixed/formatted files are re-added to the git index
6. If any tool exits non-zero, the commit is aborted and the error is shown

## Hook 2 — `.husky/commit-msg`

```sh
pnpm exec commitlint --edit "$1"
```

Triggers after the message is written (before the commit is finalized). Runs `commitlint` against the message content.

Config in `commitlint.config.mjs` (must be `.mjs` because the root `package.json` is not `"type": "module"` and commitlint config uses ESM `export default`):

```js
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    "subject-case": [0],
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};
```

### Allowed commit types

| Type       | When to use                                      |
| ---------- | ------------------------------------------------ |
| `feat`     | New user-facing feature                          |
| `fix`      | Bug fix                                          |
| `docs`     | Documentation-only change                        |
| `style`    | Formatting, whitespace, no behavior change       |
| `refactor` | Code change that is neither a feature nor a fix  |
| `perf`     | Performance improvement                          |
| `test`     | Add or modify tests                              |
| `build`    | Changes to build system (Vite, Turbo, tsconfig)  |
| `ci`       | Changes to CI configuration                      |
| `chore`    | Housekeeping, dependency bumps, internal tooling |
| `revert`   | Reverts a previous commit                        |

### Commit message format

```
<type>(<optional scope>): <subject>

<optional body>

<optional footer>
```

Examples:

```
feat(notes): add create note form
fix(health): handle timeout on /api/health
chore(deps): bump pnpm to 10.28.1
docs: add architecture diagram
refactor(http-client): extract interceptor pattern
```

### What we allow loose

- **`subject-case`** is off — you can write the subject in any case (lowercase preferred, but not enforced)
- **`body-max-line-length`** is off — long explanations in the body are fine
- **`footer-max-line-length`** is off — for long `BREAKING CHANGE:` or issue references

## Bypassing hooks (avoid unless necessary)

```bash
git commit --no-verify -m "..."   # skips both pre-commit and commit-msg
```

Only use this for genuine emergencies. Every `--no-verify` defeats the purpose of these hooks.

## What happens if a hook fails

- **pre-commit fails** → commit is rejected, your files are **not** committed
- **commit-msg fails** → commit is rejected, the files stay staged

Fix the error, re-stage the files if needed, try again.
