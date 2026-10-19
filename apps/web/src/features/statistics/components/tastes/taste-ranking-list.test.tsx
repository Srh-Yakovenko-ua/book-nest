import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import type { TasteRankingRow } from "./taste-ranking-list";

import { statisticsIds } from "../../model/statistics.fixtures";
import { TasteRankingList } from "./taste-ranking-list";

const rankingsText = messages.statistics.rankings;

const GENRE_LABELS = [
  "Fantasy",
  "Science fiction",
  "Mystery",
  "Horror",
  "Romance",
  "Poetry",
  "Drama",
] as const;

const LONG_LABEL =
  "The Extraordinarily Long Collected Chronicles of Earthsea, Its Archipelago and Every Island Beyond";

function rankingRow(label: string, value: number): TasteRankingRow {
  return { key: label, label, value, valueLabel: `${value} reads` };
}

const SEVEN_ROWS = GENRE_LABELS.map((label, index) => rankingRow(label, 70 - index * 10));

function barWidths(): string[] {
  return screen.getAllByRole("listitem").map((row) => {
    const bar = row.querySelector<HTMLElement>("[style*='width']");
    if (bar === null) throw new Error("every ranking row draws a bar");
    return bar.style.width;
  });
}

describe("TasteRankingList", () => {
  it("measures rated bars against the ten-point scale rather than the top row", () => {
    renderWithProviders(
      <TasteRankingList
        rows={[rankingRow("Fantasy", 8), rankingRow("Mystery", 6)]}
        scaleMax={10}
      />,
    );

    expect(barWidths()).toEqual(["80%", "60%"]);
  });

  it("fills a perfect ten to the end of the scale", () => {
    renderWithProviders(
      <TasteRankingList
        rows={[rankingRow("Fantasy", 10), rankingRow("Mystery", 8)]}
        scaleMax={10}
      />,
    );

    expect(barWidths()).toEqual(["100%", "80%"]);
  });

  it("measures frequency bars against the most-read row when no scale is given", () => {
    renderWithProviders(
      <TasteRankingList rows={[rankingRow("Fantasy", 4), rankingRow("Mystery", 2)]} />,
    );

    expect(barWidths()).toEqual(["100%", "50%"]);
  });

  it("keeps every row and its ordinal in the document beyond the first three", () => {
    renderWithProviders(<TasteRankingList rows={SEVEN_ROWS} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    for (const [index, label] of GENRE_LABELS.entries()) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(String(index + 1))).toBeInTheDocument();
    }
  });

  it("announces the rows beyond the first three and expands them on demand", async () => {
    renderWithProviders(<TasteRankingList rows={SEVEN_ROWS} />);

    const showMore = screen.getByRole("button", { name: "Показати ще 4" });
    expect(showMore).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(showMore);

    expect(screen.getByRole("button", { name: rankingsText.showLess })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("offers no show-more control when every row fits in the first three", () => {
    renderWithProviders(<TasteRankingList rows={SEVEN_ROWS.slice(0, 3)} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("exposes the full name as text", () => {
    renderWithProviders(
      <TasteRankingList rows={[rankingRow(LONG_LABEL, 3), rankingRow("Fantasy", 2)]} />,
    );

    expect(screen.getByText(LONG_LABEL)).toBeInTheDocument();
  });

  it("keeps rows unclickable: one show-more button, links only from context actions", () => {
    const authorRow: TasteRankingRow = {
      ...rankingRow("Ursula K. Le Guin", 90),
      contextActions: [{ authorId: statisticsIds.authorId, kind: "open_author" }],
    };

    renderWithProviders(<TasteRankingList rows={[authorRow, ...SEVEN_ROWS.slice(1)]} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName("Показати ще 4");
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", `/books?author=${statisticsIds.authorId}`);
  });
});
