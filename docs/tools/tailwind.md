# Tailwind CSS v4

## What it is

[Tailwind CSS](https://tailwindcss.com) is a utility-first CSS framework. Instead of writing custom CSS, you compose classes directly in your markup:

```tsx
<div className="flex items-center gap-2 rounded-md bg-background p-4 text-sm text-foreground">
  Hello
</div>
```

**v4** is a rewrite with a Vite-first architecture, faster build, and CSS-native configuration (no `tailwind.config.js`). It uses the `@tailwindcss/vite` plugin.

## Why we have it

- **No context switching** — style your component where you read it
- **Tree-shakeable** — only the classes you use end up in the bundle
- **Consistent spacing/sizing** — design tokens come from a scale, not ad-hoc values
- **Theme system via CSS variables** — light/dark/custom themes without JavaScript
- **Industry standard** — pairs naturally with shadcn/ui, which we use for primitives

## Setup

### `apps/web/src/index.css`

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/bricolage-grotesque";
@import "@fontsource-variable/geist-mono";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: "Bricolage Grotesque Variable", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Bricolage Grotesque Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono Variable", ui-monospace, "SF Mono", Menlo, monospace;
  /* ... color mappings ... */
  /* ... radius scale ... */
  /* ... shadow scale ... */
}

:root {
  /* light theme CSS variables in OKLCH */
}

.dark {
  /* dark theme CSS variables in OKLCH */
}

@layer base {
  /* global typographic + base rules */
}
```

### `vite.config.ts`

```ts
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss() /* ... */],
});
```

That's all. No `tailwind.config.js`, no PostCSS config. Tailwind v4 reads the `@theme` block directly from the CSS file.

## Theme — colors

All colors are defined in **OKLCH** color space (`oklch(L C H)` — lightness / chroma / hue). OKLCH is perceptually uniform — equal numeric steps produce equal visual steps.

### Light theme highlights

```css
:root {
  --background: oklch(0.985 0.003 90); /* warm off-white */
  --foreground: oklch(0.18 0.01 240); /* deep ink with cool tint */
  --primary: oklch(0.85 0.22 130); /* vivid chartreuse */
  --brand: oklch(0.85 0.22 130);
  --success: oklch(0.72 0.18 145); /* emerald */
  --warning: oklch(0.82 0.18 80); /* amber */
  --error: oklch(0.62 0.22 25); /* coral */
  --info: oklch(0.7 0.16 220); /* sky */
}
```

### Dark theme highlights

```css
.dark {
  --background: oklch(0.12 0.008 240); /* near-black, cool blue tint */
  --foreground: oklch(0.97 0.005 90); /* warm white */
  --primary: oklch(0.85 0.22 130); /* same chartreuse, pops on dark */
  /* ... */
}
```

### Semantic colors

All brand and status colors are exposed as Tailwind classes:

| Class                   | Color             |
| ----------------------- | ----------------- |
| `bg-background`         | theme background  |
| `text-foreground`       | theme foreground  |
| `bg-primary`            | chartreuse brand  |
| `text-primary`          | same as accent    |
| `bg-success`            | emerald           |
| `bg-warning`            | amber             |
| `bg-error`              | coral             |
| `bg-info`               | sky               |
| `text-muted-foreground` | dimmed foreground |
| `border-border`         | theme border      |

## Fonts

Three roles:

| Variable         | Font                         | Use                                         |
| ---------------- | ---------------------------- | ------------------------------------------- |
| `--font-sans`    | Bricolage Grotesque Variable | Body and display text                       |
| `--font-display` | Bricolage Grotesque Variable | Same as sans (using different weight/size)  |
| `--font-mono`    | Geist Mono Variable          | Technical labels, timestamps, metric values |

Tailwind classes:

```html
<p class="font-sans">Body text</p>
<h1 class="font-display font-semibold">Big heading</h1>
<span class="font-mono text-xs tracking-[0.2em] uppercase">METRIC LABEL</span>
```

Fonts are loaded via `@fontsource-variable/*` packages — bundled with the app, no CDN, no FOUT risk.

## Radii, shadows, and animations

Custom radius scale defined in `@theme inline`:

```css
--radius-sm: calc(var(--radius) * 0.5);
--radius-md: calc(var(--radius) * 0.75);
--radius-lg: var(--radius);
--radius-xl: calc(var(--radius) * 1.5);
--radius-2xl: calc(var(--radius) * 2);
```

Custom shadow scale:

```css
--shadow-soft: 0 1px 2px 0 oklch(0 0 0 / 0.06), 0 1px 3px -1px oklch(0 0 0 / 0.04);
--shadow-pop: 0 4px 12px -2px oklch(0 0 0 / 0.12), 0 2px 6px -2px oklch(0 0 0 / 0.08);
--shadow-card: 0 1px 0 0 oklch(1 0 0 / 0.04) inset, 0 4px 16px -4px oklch(0 0 0 / 0.18);
--shadow-glow-brand: 0 0 0 1px var(--brand), 0 0 32px -4px var(--brand);
```

Animations via `tw-animate-css` (a Tailwind plugin loaded in index.css):

```html
<div class="animate-in delay-100 duration-700 fill-mode-both fade-in slide-in-from-bottom-3">
  Content that slides in from below with a 100ms delay
</div>
```

## Selection and typography tweaks

```css
@layer base {
  html {
    @apply font-sans antialiased;
    font-feature-settings:
      "ss01" on,
      "ss02" on,
      "cv11" on;
    text-rendering: optimizeLegibility;
  }

  h1,
  h2,
  h3,
  h4 {
    @apply font-display tracking-tight;
  }

  code,
  kbd,
  pre,
  samp,
  .font-mono {
    font-variant-numeric: tabular-nums;
  }

  ::selection {
    background-color: oklch(0.85 0.22 130 / 0.35);
    color: var(--foreground);
  }
}
```

- Selection color is chartreuse at 35% opacity
- All mono text uses tabular figures (same-width digits)
- Bricolage's stylistic sets `ss01`, `ss02`, `cv11` are enabled globally

## Auto-sorting

`prettier-plugin-tailwindcss` sorts classes in canonical order on save. See [Prettier](./prettier.md).

## Linting

`eslint-plugin-better-tailwindcss` validates classes:

- Unknown classes (typos)
- Conflicting classes (`px-4 px-6`)
- Duplicate classes
- Deprecated v3 class names

See [ESLint](./eslint.md).
