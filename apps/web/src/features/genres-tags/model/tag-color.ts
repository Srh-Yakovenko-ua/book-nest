import type { Nullable } from "@app/shared";

import { z } from "zod";

export const TAG_COLORS = [
  "parchment",
  "terracotta",
  "honey",
  "sage",
  "forest",
  "sky",
  "lavender",
  "rose",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export const TAG_COLOR_DEFAULT: TagColor = "parchment";

export const TagColorSchema = z.enum(TAG_COLORS);

export type TagColorStyle = {
  bg: string;
  border: string;
  text: string;
};

export const TAG_COLOR_STYLES = {
  forest: {
    bg: "oklch(0.91 0.032 130)",
    border: "oklch(0.76 0.06 135)",
    text: "oklch(0.36 0.07 135)",
  },
  honey: {
    bg: "var(--warning-soft)",
    border: "oklch(0.86 0.06 70)",
    text: "var(--warning)",
  },
  lavender: {
    bg: "oklch(0.94 0.028 305)",
    border: "oklch(0.82 0.05 305)",
    text: "oklch(0.45 0.075 305)",
  },
  parchment: {
    bg: "var(--tag)",
    border: "var(--border)",
    text: "var(--tag-foreground)",
  },
  rose: {
    bg: "var(--error-soft)",
    border: "oklch(0.84 0.055 25)",
    text: "var(--error)",
  },
  sage: {
    bg: "var(--success-soft)",
    border: "oklch(0.82 0.055 145)",
    text: "var(--success)",
  },
  sky: {
    bg: "var(--info-soft)",
    border: "oklch(0.82 0.045 250)",
    text: "var(--info)",
  },
  terracotta: {
    bg: "oklch(0.93 0.035 53.5)",
    border: "oklch(0.78 0.07 53.5)",
    text: "oklch(0.42 0.085 53.5)",
  },
} as const satisfies Record<TagColor, TagColorStyle>;

export function resolveTagColor(value: Nullable<string> | undefined): TagColor {
  const parsed = TagColorSchema.safeParse(value);
  return parsed.success ? parsed.data : TAG_COLOR_DEFAULT;
}

export function tagColorStyle(color: TagColor): {
  backgroundColor: string;
  borderColor: string;
  color: string;
} {
  const style = TAG_COLOR_STYLES[color];
  return { backgroundColor: style.bg, borderColor: style.border, color: style.text };
}
