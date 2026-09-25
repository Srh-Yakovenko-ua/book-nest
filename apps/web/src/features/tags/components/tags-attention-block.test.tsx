import "@testing-library/jest-dom/vitest";

import type { TagsSummaryView } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { TagsAttentionBlock } from "./tags-overview-blocks";

const SUMMARY: TagsSummaryView = {
  colorCounts: {
    forest: 0,
    honey: 0,
    lavender: 0,
    parchment: 4,
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
  typeCounts: { atmosphere: 0, character: 0, custom: 4, format: 0, theme: 0, trope: 0 },
  usageDistribution: { booksOnly: 0, both: 0, charactersOnly: 0, unused: 4 },
};

const ALL_USED: TagsSummaryView = {
  ...SUMMARY,
  usageDistribution: { booksOnly: 4, both: 0, charactersOnly: 0, unused: 0 },
};

function renderAttention(summary: TagsSummaryView, isShowingUnused = false) {
  const onShowUnused = vi.fn();
  renderWithProviders(
    <TagsAttentionBlock
      isShowingUnused={isShowingUnused}
      onShowUnused={onShowUnused}
      summary={summary}
    />,
  );
  return { onShowUnused };
}

describe("TagsAttentionBlock", () => {
  it("shows unused tags as one clickable row with a chevron", async () => {
    const { onShowUnused } = renderAttention(SUMMARY);

    const row = screen.getByRole("button", { name: /4 теги ще не використовуються/ });
    expect(row).toHaveTextContent("Не пов’язані з книгами чи персонажами");
    expect(row).toHaveAttribute("aria-pressed", "false");
    const icons = Array.from(row.querySelectorAll("use")).map((use) => use.getAttribute("href"));
    expect(icons).toEqual([
      "/icons/ui-icons.svg#i-circle-slash",
      "/icons/ui-icons.svg#i-chevron-right",
    ]);
    expect(screen.queryByRole("button", { name: "Показати невикористані" })).toBeNull();

    await userEvent.click(row);

    expect(onShowUnused).toHaveBeenCalledOnce();
  });

  it("marks the row active while filter=unused is applied", () => {
    renderAttention(SUMMARY, true);

    expect(screen.getByRole("button", { name: /ще не використовуються/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows the all-clear state without an action when every tag is used", () => {
    renderAttention(ALL_USED);

    expect(screen.getByText("Усі теги використовуються")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
