import "@testing-library/jest-dom/vitest";

import type { TagsSummaryView } from "@app/shared";
import type { UrlUpdateEvent } from "nuqs/adapters/testing";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { useTagQuery } from "../model/use-tag-query";
import { TagsStructureBlock } from "./tags-overview-blocks";

const SUMMARY: TagsSummaryView = {
  colorCounts: {
    forest: 0,
    honey: 0,
    lavender: 0,
    parchment: 0,
    rose: 0,
    sage: 0,
    sky: 0,
    terracotta: 0,
  },
  mostUsed: null,
  taggedBooksCount: 0,
  taggedCharactersCount: 0,
  totalBooksCount: 0,
  totalCharactersCount: 0,
  totalTagsCount: 4,
  typeCounts: { atmosphere: 1, character: 0, custom: 1, format: 0, theme: 0, trope: 2 },
  usageDistribution: { booksOnly: 0, both: 0, charactersOnly: 0, unused: 4 },
};

const TYPE_ICONS = [
  { icon: "repeat-2", label: "Тропи" },
  { icon: "sparkles", label: "Атмосфера" },
  { icon: "book-open-text", label: "Теми" },
  { icon: "users-round", label: "Персонажі" },
  { icon: "file-text", label: "Формат" },
  { icon: "hash", label: "Власний тег" },
] as const;

function iconTileOf(row: HTMLElement): HTMLElement {
  const tile = row.querySelector("use")?.closest("span");
  if (tile === null || tile === undefined) throw new Error("no icon tile");
  return tile;
}

function renderStructure(searchParams = "") {
  const urlUpdates: UrlUpdateEvent[] = [];
  renderWithProviders(
    <NuqsTestingAdapter
      hasMemory
      onUrlUpdate={(event) => urlUpdates.push(event)}
      searchParams={searchParams}
    >
      <StructureHarness />
    </NuqsTestingAdapter>,
  );
  return { urlUpdates };
}

function StructureHarness() {
  const query = useTagQuery();
  return (
    <TagsStructureBlock
      onToggleType={query.toggleType}
      selectedTypes={query.state.type}
      summary={SUMMARY}
    />
  );
}

function typeRow(label: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${label}:`) });
}

describe("TagsStructureBlock", () => {
  it("renders every type with its own icon in schema order", () => {
    renderStructure();

    const rows = screen.getAllByRole("button");
    expect(rows).toHaveLength(TYPE_ICONS.length);
    for (const [index, { icon, label }] of TYPE_ICONS.entries()) {
      expect(rows[index]).toHaveAccessibleName(new RegExp(`^${label}:`));
      expect(rows[index]?.querySelector("use")).toHaveAttribute(
        "href",
        `/icons/ui-icons.svg#i-${icon}`,
      );
    }
  });

  it("keeps count and share in the row label", () => {
    renderStructure();

    expect(typeRow("Тропи")).toHaveAccessibleName("Тропи: 2 теги, 50%");
    expect(typeRow("Тропи")).toHaveTextContent("2 теги · 50%");
  });

  it("mutes a zero-count type while keeping its icon visible", () => {
    renderStructure();

    const theme = typeRow("Теми");
    expect(iconTileOf(theme)).toHaveClass("bg-muted", "text-muted-foreground");
    expect(theme.querySelector("use")).toHaveAttribute(
      "href",
      "/icons/ui-icons.svg#i-book-open-text",
    );
    expect(iconTileOf(typeRow("Тропи"))).toHaveClass("bg-accent/40", "text-accent-foreground");
    expect(iconTileOf(typeRow("Тропи"))).not.toHaveClass("bg-muted");
  });

  it("marks selected types as pressed and leaves the rest unpressed", () => {
    renderStructure("?type=trope");

    expect(typeRow("Тропи")).toHaveAttribute("aria-pressed", "true");
    expect(typeRow("Атмосфера")).toHaveAttribute("aria-pressed", "false");
    expect(typeRow("Теми")).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles the type[] filter in the URL", async () => {
    const { urlUpdates } = renderStructure("?type=trope");

    await userEvent.click(typeRow("Атмосфера"));
    await waitFor(() =>
      expect(new URLSearchParams(urlUpdates.at(-1)?.queryString).get("type")).toBe(
        "trope,atmosphere",
      ),
    );
    expect(typeRow("Атмосфера")).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(typeRow("Тропи"));
    await waitFor(() =>
      expect(new URLSearchParams(urlUpdates.at(-1)?.queryString).get("type")).toBe("atmosphere"),
    );
    expect(typeRow("Тропи")).toHaveAttribute("aria-pressed", "false");
  });
});
