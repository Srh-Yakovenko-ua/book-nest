import type { BookNestPaletteColor } from "@app/shared";

type PaletteColorStyle = {
  bg: string;
  border: string;
  marker: string;
  text: string;
};

export const PALETTE_COLOR_STYLES = {
  parchment: {
    bg: "var(--tag-parchment)",
    border: "var(--tag-parchment-border)",
    text: "var(--tag-parchment-foreground)",
    marker: "var(--tag-parchment-foreground)",
  },
  terracotta: {
    bg: "var(--tag-terracotta)",
    border: "var(--tag-terracotta-border)",
    text: "var(--tag-terracotta-foreground)",
    marker: "var(--tag-terracotta-foreground)",
  },
  honey: {
    bg: "var(--tag-honey)",
    border: "var(--tag-honey-border)",
    text: "var(--tag-honey-foreground)",
    marker: "var(--tag-honey-foreground)",
  },
  sage: {
    bg: "var(--tag-sage)",
    border: "var(--tag-sage-border)",
    text: "var(--tag-sage-foreground)",
    marker: "var(--tag-sage-foreground)",
  },
  forest: {
    bg: "var(--tag-forest)",
    border: "var(--tag-forest-border)",
    text: "var(--tag-forest-foreground)",
    marker: "var(--tag-forest-foreground)",
  },
  sky: {
    bg: "var(--tag-sky)",
    border: "var(--tag-sky-border)",
    text: "var(--tag-sky-foreground)",
    marker: "var(--tag-sky-foreground)",
  },
  lavender: {
    bg: "var(--tag-lavender)",
    border: "var(--tag-lavender-border)",
    text: "var(--tag-lavender-foreground)",
    marker: "var(--tag-lavender-foreground)",
  },
  rose: {
    bg: "var(--tag-rose)",
    border: "var(--tag-rose-border)",
    text: "var(--tag-rose-foreground)",
    marker: "var(--tag-rose-foreground)",
  },
} as const satisfies Record<BookNestPaletteColor, PaletteColorStyle>;
