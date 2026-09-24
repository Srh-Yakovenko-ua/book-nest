import type { TagColor } from "@app/shared";

type TagColorStyle = {
  bg: string;
  border: string;
  text: string;
};

export const TAG_COLOR_STYLES = {
  forest: {
    bg: "var(--tag-forest)",
    border: "var(--tag-forest-border)",
    text: "var(--tag-forest-foreground)",
  },
  honey: {
    bg: "var(--tag-honey)",
    border: "var(--tag-honey-border)",
    text: "var(--tag-honey-foreground)",
  },
  lavender: {
    bg: "var(--tag-lavender)",
    border: "var(--tag-lavender-border)",
    text: "var(--tag-lavender-foreground)",
  },
  parchment: {
    bg: "var(--tag-parchment)",
    border: "var(--tag-parchment-border)",
    text: "var(--tag-parchment-foreground)",
  },
  rose: {
    bg: "var(--tag-rose)",
    border: "var(--tag-rose-border)",
    text: "var(--tag-rose-foreground)",
  },
  sage: {
    bg: "var(--tag-sage)",
    border: "var(--tag-sage-border)",
    text: "var(--tag-sage-foreground)",
  },
  sky: {
    bg: "var(--tag-sky)",
    border: "var(--tag-sky-border)",
    text: "var(--tag-sky-foreground)",
  },
  terracotta: {
    bg: "var(--tag-terracotta)",
    border: "var(--tag-terracotta-border)",
    text: "var(--tag-terracotta-foreground)",
  },
} as const satisfies Record<TagColor, TagColorStyle>;
