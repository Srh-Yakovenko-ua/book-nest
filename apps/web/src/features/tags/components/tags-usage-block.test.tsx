import "@testing-library/jest-dom/vitest";

import type { TagsSummaryView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { renderWithProviders, screen, within } from "@/test-utils";

import { TagsUsageBlock } from "./tags-overview-blocks";

const EMPTY_SUMMARY: TagsSummaryView = {
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
  totalTagsCount: 0,
  typeCounts: { atmosphere: 0, character: 0, custom: 0, format: 0, theme: 0, trope: 0 },
  usageDistribution: { booksOnly: 0, both: 0, charactersOnly: 0, unused: 0 },
};

const SUMMARY: TagsSummaryView = {
  ...EMPTY_SUMMARY,
  totalTagsCount: 8,
  usageDistribution: { booksOnly: 4, both: 0, charactersOnly: 2, unused: 2 },
};

const ROWS = [
  { icon: "book", label: "Лише в книгах" },
  { icon: "user-round", label: "Лише в персонажах" },
  { icon: "link", label: "У книгах і персонажах" },
  { icon: "circle-slash", label: "Не використовуються" },
] as const;

function legendRow(label: string): HTMLElement {
  const row = screen.getByText(label).closest("li");
  if (row === null) throw new Error(`no legend row for ${label}`);
  return row;
}

function renderUsage(summary: TagsSummaryView) {
  renderWithProviders(<TagsUsageBlock summary={summary} />);
}

function segmentWidths(): Record<string, string> {
  return Object.fromEntries(
    Array.from(usageBar().querySelectorAll<HTMLElement>("[data-segment]")).map((segment) => [
      segment.dataset.segment,
      segment.style.width,
    ]),
  );
}

function shareLineOf(label: string): HTMLElement {
  const line = screen.getByText(label).parentElement;
  if (line === null) throw new Error(`no share line for ${label}`);
  return line;
}

function usageBar(): HTMLElement {
  const bar = screen.getByRole("list").previousElementSibling;
  if (!(bar instanceof HTMLElement)) throw new Error("no usage bar");
  return bar;
}

describe("TagsUsageBlock", () => {
  it("lists every usage category with its count and share", () => {
    renderUsage(SUMMARY);

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows).toHaveLength(ROWS.length);
    expect(legendRow("Лише в книгах")).toHaveTextContent("4 теги · 50%");
    expect(legendRow("Лише в персонажах")).toHaveTextContent("2 теги · 25%");
    expect(legendRow("У книгах і персонажах")).toHaveTextContent("0 тегів · 0%");
    expect(legendRow("Не використовуються")).toHaveTextContent("2 теги · 25%");
  });

  it("renders one segment per non-empty category sized by its share", () => {
    renderUsage(SUMMARY);

    expect(usageBar()).toHaveAttribute("aria-hidden", "true");
    expect(segmentWidths()).toEqual({
      booksOnly: "50%",
      charactersOnly: "25%",
      unused: "25%",
    });
  });

  it("shows the matching icon for each legend row", () => {
    renderUsage(SUMMARY);

    for (const { icon, label } of ROWS) {
      expect(legendRow(label).querySelector("use")).toHaveAttribute(
        "href",
        `/icons/ui-icons.svg#i-${icon}`,
      );
    }
  });

  it("mutes a zero-count category without hiding it", () => {
    renderUsage(SUMMARY);

    expect(shareLineOf("У книгах і персонажах")).toHaveClass("text-muted-foreground");
    expect(shareLineOf("Лише в книгах")).not.toHaveClass("text-muted-foreground");
  });

  it("renders an empty track and muted zero rows when there are no tags", () => {
    renderUsage(EMPTY_SUMMARY);

    expect(usageBar()).toHaveClass("bg-muted");
    expect(usageBar()).toBeEmptyDOMElement();
    expect(screen.getByRole("region").innerHTML).not.toContain("NaN");
    for (const { label } of ROWS) {
      expect(legendRow(label)).toHaveTextContent("0 тегів · 0%");
      expect(shareLineOf(label)).toHaveClass("text-muted-foreground");
    }
  });

  it.each([
    [0, "0 тегів"],
    [1, "1 тег"],
    [2, "2 теги"],
    [4, "4 теги"],
    [5, "5 тегів"],
    [11, "11 тегів"],
    [12, "12 тегів"],
    [21, "21 тег"],
    [22, "22 теги"],
    [25, "25 тегів"],
    [111, "111 тегів"],
  ])("names %i tags as «%s»", (count, expected) => {
    renderUsage({
      ...EMPTY_SUMMARY,
      totalTagsCount: count,
      usageDistribution: { booksOnly: count, both: 0, charactersOnly: 0, unused: 0 },
    });

    expect(legendRow("Лише в книгах")).toHaveTextContent(`${expected} ·`);
  });

  it("sets the count in semibold and leaves the unit muted", () => {
    renderUsage(SUMMARY);

    const count = within(legendRow("Лише в книгах")).getByText("4");
    expect(count).toHaveClass("font-semibold");
    expect(count.parentElement).toHaveClass("text-muted-foreground");
  });
});
