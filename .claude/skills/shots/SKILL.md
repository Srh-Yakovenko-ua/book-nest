---
name: shots
description: Capture a feature's screens as a screenshot pack for a design review (desktop 1280 and phone 390, light and dark, from the app and from Storybook) with an index and a ready review prompt. Use when the user asks for screenshots of a feature or its states, "скріншоти", "скриншоты", "зроби скріни", "для дизайн-рев'ю", "для GPT", or when a UI feature is finished and its screens should be handed over. Also when adding a new feature to the pack.
---

# Shots

`pnpm shots <feature>` drives headless Chromium through a per-feature manifest and writes PNGs, `index.md` and `GPT_PROMPT.md` to `D:\IT\book-nest-qa\<feature>-<date>\shots\`. The user drags that folder into ChatGPT for a design review. It replaces screenshots taken by hand and the Chrome extension, which cannot render a 390 px viewport (see the `narrow-viewport-screenshots` memory).

Code: `apps/web/scripts/shots/`. Manifests: `apps/web/scripts/shots/manifests/<feature>.ts`, registered in `manifests/index.ts`. Known features are listed by `pnpm shots nope`.

## Steps

1. **Pick the base URL.** For work on a branch, `http://localhost:3000` (the default) served by `pnpm dev:web:dev` from the checkout that holds the change; it proxies to the dev API with real data. After a deploy, `--base https://dev.book-nest.net`. Check the base answers (`curl -s -o /dev/null -w "%{http_code}" <base>/api/health`) before running.
2. **Session, only when missing or rejected.** The run fails fast with `No saved session` or `no longer works`. Then run `pnpm shots login --base <url>` in the background and tell the user, in one line, to log in in the Chromium window that opened (it waits 10 minutes). Never type credentials yourself. The session lands in `<git common dir>/shots/<host>.json`: shared by every worktree, never committed.
3. **Run** `pnpm shots <feature>` in the background (a few minutes; add `--locales uk,en`, `--only app|storybook`, `--viewports`, `--themes` when asked). It starts Storybook on :6006 if nothing answers there and stops it afterwards.
4. **Look before handing over.** Read `index.md`: every `Не знято` line and every note in the `Зауваги` column. Open two or three PNGs yourself (one desktop, one mobile, one dark). A login page, a skeleton, a dev overlay or a toast in a screenshot is a defect of the pack: fix the cause and rerun rather than shipping it.
5. **Report** the folder path, the captured and skipped counts with the skip reasons, and that `GPT_PROMPT.md` holds the text to paste with the images.

## Traps

- **One run per host at a time.** Every page load rotates the refresh token, and the API revokes the whole session when an old token is presented more than 10 s after rotation. Two parallel runs, or a run beside `shots login`, log the user out. The script uses one browser context per viewport, sequentially, and re-saves the session after each; keep it that way.
- **The dev API allows about 120 requests a minute.** Each full page load costs around ten. In manifests, reach tabs and filters with `click` steps on the already open page instead of new `path`s. On a 429 the script waits 65 s and retries the scene once.
- **Manifests never change data.** Steps open, switch and close (dialogs close with `Escape`); they never click Save, Archive, Delete or a confirmation. The runs hit shared dev data on the user's test account, and a pack is meant to be rerun freely.
- **Storybook renders in Ukrainian only**: the preview loads `uk.json`, so story scenes ignore `--locales`.
- **A Storybook already on the port is reused as it is**, even one started from another worktree or branch, and it is left running. When the stories just changed, stop that Storybook first, or the pack shows the old versions. The script says on its first line which case it took.
- **Storybook's first load is slow.** A cold Storybook optimises its dependencies on the first iframe request, which took longer than Playwright's default 30 s here. Story pages therefore get a 180 s timeout, and a failed story becomes a skipped row instead of ending the run.
- **Lazy images.** Illustrations are `next/image` with lazy loading, so content below the first screen has not loaded when the page settles. `capture` stretches the viewport first and then waits for every `img` to complete; a timeout shows up as a note in `index.md`.
- **Dev overlays** are hidden by `HIDDEN_OVERLAYS` in `shots-page.ts`: the Next.js indicator, react-scan (its toolbar, `html > div` hosts and the `html > canvas` that draws render outlines over the page) and the React Query devtools button. All of them load only under `next dev`. A new overlay showing up in screenshots goes into that list.
- **Fixed elements and full-page shots.** The sidebar is `fixed` with `h-svh`, so a plain full-page screenshot cuts it, and a modal backdrop, at the first viewport height. A `page` capture therefore stretches the viewport to the document height first. A scene whose subject is a dialog or a menu sets `capture: "viewport"`, or the stretched viewport would centre the dialog in a page-tall image.

## Adding a feature

A manifest is a `ShotsManifest` (`shots-manifest.ts`):

- `title`, `summary` and `focus` are Ukrainian text that goes straight into `index.md` and `GPT_PROMPT.md`: what the feature does and what the reviewer should look at.
- `appScenes`, in capture order. A scene with `path` (written without the locale prefix, with `{target}` placeholders) opens a page. A scene without one continues on the previous scene's page, so it is skipped when that scene failed. `steps` find elements by role and a name per locale; use a RegExp when the accessible name carries a count (`/^Зараховані/`). `viewports: ["mobile"]` limits a scene to phones. A scene that opens a dialog or a menu adds `capture: "viewport"` and a `cleanup` step that closes it.
- `discoverTargets` resolves the placeholders from the API responses the page already makes (`page.waitForResponse` before `open`), parsed with Zod. The reading-goals manifest finds one goal per status this way. A placeholder with no match skips its scene with a reason in `index.md`.
- `stories` covers states the test account does not have. Put them in `apps/web/src/features/<feature>/components/<feature>-screens.stories.tsx` with title `<Feature>/Screens`, rendering the page-level component in the app's page container with fetch stubbed; the worked example is `reading-goals-screens.stories.tsx`. The manifest references them by story id (`reading-goals-screens--completed-goal`). A missing id is reported as skipped, not as a crash.

After a manifest change, run `pnpm --filter @app/web exec tsc --noEmit -p scripts/shots` and one `pnpm shots <feature>` before calling it done.
