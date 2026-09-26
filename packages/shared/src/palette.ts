import { z } from "zod";

export const BOOK_NEST_PALETTE_COLORS = [
  "parchment",
  "terracotta",
  "honey",
  "sage",
  "forest",
  "sky",
  "lavender",
  "rose",
] as const;

export const BookNestPaletteColorSchema = z.enum(BOOK_NEST_PALETTE_COLORS);

export type BookNestPaletteColor = z.infer<typeof BookNestPaletteColorSchema>;

const FALLBACK_PALETTE_COLOR = "parchment" satisfies BookNestPaletteColor;

export function pickAvailablePaletteColor(
  usedColors: readonly string[] = [],
): BookNestPaletteColor {
  const usageByColor = new Map<BookNestPaletteColor, number>(
    BOOK_NEST_PALETTE_COLORS.map((color) => [color, 0]),
  );
  for (const used of usedColors) {
    const parsed = BookNestPaletteColorSchema.safeParse(used);
    if (parsed.success) {
      usageByColor.set(parsed.data, (usageByColor.get(parsed.data) ?? 0) + 1);
    }
  }

  let leastUsed: BookNestPaletteColor = FALLBACK_PALETTE_COLOR;
  let leastUsage = Number.POSITIVE_INFINITY;
  for (const color of BOOK_NEST_PALETTE_COLORS) {
    const usage = usageByColor.get(color) ?? 0;
    if (usage === 0) {
      return color;
    }
    if (usage < leastUsage) {
      leastUsage = usage;
      leastUsed = color;
    }
  }
  return leastUsed;
}
