# shadcn/ui

## What it is

[shadcn/ui](https://ui.shadcn.com) is a collection of reusable React components. Unlike typical UI libraries, shadcn is **not an npm package** — its CLI copies the component source code directly into your repo:

```
apps/web/src/components/ui/button.tsx   ← lives in YOUR codebase
```

You own the code. Upgrades are opt-in per component. You can customize any component by editing the file directly.

Each component is built on:

- [**Radix UI**](https://www.radix-ui.com) primitives for headless accessibility and behavior
- **Tailwind CSS** for styling
- [**class-variance-authority**](https://cva.style) (cva) for variant definitions

## Why we have it

- **Ownership** — no version bump surprises, no "library doesn't do X" frustration
- **Customizable** — edit the file, add a variant, remove a prop, ship it
- **Accessible by default** — Radix handles ARIA, keyboard navigation, focus management
- **Themeable** — integrates with our Tailwind CSS variable theme
- **AI-friendly** — code lives in your repo, so tools (including Claude) can read and modify it

## Preset

We use the **radix-nova** preset (via `pnpm dlx shadcn@latest init -b radix -p nova`). Characteristics:

- Components use `radix-ui` (the unified package) instead of individual `@radix-ui/react-*` packages
- Geist Variable as the default sans font (we override with Bricolage Grotesque)
- CSS variable theming with OKLCH colors
- `tw-animate-css` for transitions
- `data-slot` attributes on every component for advanced styling hooks
- No `<Form>` component (unlike the default preset) — use react-hook-form directly

### Config file — `apps/web/components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

The `aliases` section tells the CLI where to put new components.

## Current vendored components

39 components live in `apps/web/src/components/ui/`:

```
alert              alert-dialog       avatar             badge
breadcrumb         button             calendar           card
chart              checkbox           collapsible        command
context-menu       dialog             drawer             dropdown-menu
hover-card         input              input-group        input-otp
label              pagination         popover            progress
radio-group        scroll-area        select             separator
sheet              skeleton           slider             sonner
switch             table              tabs               textarea
toggle             toggle-group       tooltip
```

Each file is self-contained — one component, its variants, and its types.

## Adding a new component

```bash
cd apps/web
pnpm dlx shadcn@latest add <name>
# e.g., pnpm dlx shadcn@latest add accordion
```

The CLI:

1. Downloads the component source from the shadcn registry
2. Installs any missing Radix/npm dependencies
3. Writes the file to `src/components/ui/<name>.tsx`
4. Prompts before overwriting existing files

## Our customizations to vendored files

Two components have been modified from the default shadcn output:

### `button.tsx`

- Wrapped in `React.forwardRef` so it can be used as `asChild` in Radix primitives (DropdownMenuTrigger, TooltipTrigger). The radix-nova preset ships it as a plain function, which causes ref warnings under React 18.
- Added `cursor-pointer` to the base cva classes so every button has a pointer cursor without repeating it at call sites.
- Added `disabled:cursor-not-allowed` for the disabled state.

### `dropdown-menu.tsx`

- Replaced all instances of `cursor-default` with `cursor-pointer` on menu items so clickable items feel interactive.

These customizations will be overwritten if you re-run `shadcn add button` or `shadcn add dropdown-menu`. The CLI will prompt before overwriting.

## Usage

Import from `@/components/ui/<name>`:

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

Compose naturally:

```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" />
  <Button type="submit">Submit</Button>
</div>
```

## Rules

- **Never edit** `components/ui/**` files unless you have a deliberate reason (like our `button.tsx` customization). Re-running the shadcn CLI will overwrite them.
- **Never handroll** a button, dialog, popover, or dropdown. Use the shadcn primitive and add a variant if needed.
- **Feature-local composition** — build feature-specific UI by composing shadcn primitives, not by wrapping them in your own abstraction layer.
- If you need to customize globally, edit the cva variants inside the component file itself, not at call sites.

## Related tools

- [Tailwind CSS v4](./tailwind.md) — styling engine
- [Prettier](./prettier.md) — auto-sorts Tailwind classes
- [ESLint](./eslint.md) — lints Tailwind classes
