import "@testing-library/jest-dom/vitest";

import type { TagsSummaryView } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { TagsPaletteBlock } from "./tags-overview-blocks";

const SUMMARY: TagsSummaryView = {
  colorCounts: {
    forest: 0,
    honey: 2,
    lavender: 5,
    parchment: 21,
    rose: 0,
    sage: 3,
    sky: 1,
    terracotta: 0,
  },
  mostUsed: null,
  taggedBooksCount: 0,
  taggedCharactersCount: 0,
  totalBooksCount: 0,
  totalCharactersCount: 0,
  totalTagsCount: 32,
  typeCounts: { atmosphere: 0, character: 0, custom: 32, format: 0, theme: 0, trope: 0 },
  usageDistribution: { booksOnly: 0, both: 0, charactersOnly: 0, unused: 32 },
};

function renderPalette(selectedColors: Parameters<typeof TagsPaletteBlock>[0]["selectedColors"]) {
  const onToggleColor = vi.fn();
  renderWithProviders(
    <TagsPaletteBlock
      onToggleColor={onToggleColor}
      selectedColors={selectedColors}
      summary={SUMMARY}
    />,
  );
  return { onToggleColor };
}

function swatchButtons(): HTMLElement[] {
  return within(screen.getByRole("list")).getAllByRole("button");
}

describe("TagsPaletteBlock", () => {
  it("keeps every color, zero counts included, in a 4-column grid", () => {
    renderPalette([]);

    expect(screen.getByRole("list")).toHaveClass("grid-cols-4");
    expect(swatchButtons()).toHaveLength(8);
  });

  it.each([
    ["sky", "Небесний", "1 тег"],
    ["honey", "Медовий", "2 теги"],
    ["lavender", "Лаванда", "5 тегів"],
    ["parchment", "Пергамент", "21 тег"],
    ["rose", "Пудрова троянда", "0 тегів"],
  ] as const)("names the %s count as «%s: %s»", (color, label, expected) => {
    renderPalette([]);

    const button = screen.getByRole("button", { name: new RegExp(`^${label}`) });
    expect(button).toHaveTextContent(expected);
    expect(button.querySelector("[data-selected]")?.getAttribute("style")).toContain(
      `var(--tag-${color})`,
    );
  });

  it("mutes a zero-count color without disabling it", async () => {
    const { onToggleColor } = renderPalette([]);
    const rose = screen.getByRole("button", { name: /^Пудрова троянда/ });

    expect(within(rose).getByText("0 тегів")).toHaveClass("text-muted-foreground");
    expect(rose).toBeEnabled();
    await userEvent.click(rose);
    expect(onToggleColor).toHaveBeenCalledWith("rose");
  });

  it("marks a selected color with a ring and a check on the swatch", () => {
    renderPalette(["sky", "sage"]);

    const pressed = swatchButtons().filter((item) => item.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(2);
    for (const button of pressed) {
      const swatch = button.querySelector("[data-selected]");
      expect(swatch).toHaveClass("outline-current");
      expect(swatch?.className).not.toMatch(/primary/);
      expect(button).toHaveClass("bg-secondary/50");
      expect(swatch?.querySelector("use")).toHaveAttribute("href", "/icons/ui-icons.svg#i-check");
    }
  });

  it("toggles a selected color off on a second click", async () => {
    const { onToggleColor } = renderPalette(["sky"]);
    const sky = swatchButtons().find((item) => item.getAttribute("aria-pressed") === "true");
    if (sky === undefined) throw new Error("no selected swatch");

    await userEvent.click(sky);

    expect(onToggleColor).toHaveBeenCalledWith("sky");
  });

  it("shows the color name and count in a tooltip on hover", async () => {
    renderPalette([]);
    const user = userEvent.setup();
    const sky = swatchButtons().find((item) => item.textContent === "1 тег");
    if (sky === undefined) throw new Error("no sky swatch");

    await user.hover(sky);

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Небесний · 1 тег");
  });
});
