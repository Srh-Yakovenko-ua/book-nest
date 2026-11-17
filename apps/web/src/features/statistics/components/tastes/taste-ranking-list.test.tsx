import type { Nullable, ReadingStatisticsCompletedReadsSubsetPage } from "@app/shared";
import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { TasteRankingRow } from "./taste-ranking-list";

import { completedReadFixture, statisticsIds } from "../../model/statistics.fixtures";
import { TasteRankingList } from "./taste-ranking-list";

const rankingsText = messages.statistics.rankings;

const subsetText = messages.statistics.details.subset;

const SUBSET_PATH = "/api/statistics/completed-reads/subset";

const AUTHOR = "Урсула Ле Ґуїн";

const FIRST_QUARTER = { from: "2026-01-01", to: "2026-03-31" };

const SECOND_QUARTER = { from: "2026-04-01", to: "2026-06-30" };

const SUBSET_PAGE: ReadingStatisticsCompletedReadsSubsetPage = {
  items: [
    completedReadFixture({ authorName: "Інша авторка", finishedAt: "2026-03-14" }),
    completedReadFixture({
      authorName: null,
      book: {
        bookId: statisticsIds.secondBookId,
        bookState: "active",
        coverThumbUrl: null,
        title: "Гробниці Атуану",
      },
      finishedAt: "2026-03-02",
      readingCycleId: statisticsIds.secondCycleId,
    }),
  ],
  nextCursor: null,
  totalCount: 2,
};

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

type SubsetPeriod = { from: Nullable<string>; to: string };

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost");
  if (url.pathname === SUBSET_PATH) return Promise.resolve(jsonResponse(SUBSET_PAGE));
  return Promise.reject(new Error(`unexpected fetch ${url.pathname}`));
});

function authorRow(period: SubsetPeriod = FIRST_QUARTER): TasteRankingRow {
  return {
    ...rankingRow(AUTHOR, 2),
    contextActions: [{ authorId: statisticsIds.authorId, kind: "open_author" }],
    drilldown: {
      filters: { authorId: statisticsIds.authorId },
      kind: "completed_reads_subset",
      period,
    },
  };
}

function authorSubsetRequest({ from, to }: { from: string; to: string }) {
  return { authorId: statisticsIds.authorId, limit: "20", periodFrom: from, periodTo: to };
}

function dialogTitle(name: string): string {
  return subsetText.title.replace("{name}", name);
}

function genreSubsetRow(row: TasteRankingRow): TasteRankingRow {
  return {
    ...row,
    drilldown: {
      filters: { genre: row.key },
      kind: "completed_reads_subset",
      period: FIRST_QUARTER,
    },
  };
}

function isSubsetTrigger(accessibleName: string): boolean {
  return accessibleName.startsWith(openLabel(""));
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function openLabel(name: string): string {
  return subsetText.open.replace("{name}", name);
}

function subsetRequests(): Record<string, string>[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === SUBSET_PATH)
    .map((url) => Object.fromEntries(url.searchParams));
}

describe("TasteRankingList finished-reads drill-down", () => {
  beforeEach(() => {
    vi.stubGlobal("innerWidth", 1280);
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("turns only a row with a single-attribute subset into a dialog trigger", () => {
    renderWithProviders(
      <TasteRankingList
        rows={[
          authorRow(),
          rankingRow("Fantasy", 1),
          {
            ...rankingRow("Земномор'я", 1),
            drilldown: {
              filters: { seriesId: statisticsIds.seriesId },
              kind: "completed_reads_subset",
              period: FIRST_QUARTER,
            },
          },
        ]}
      />,
    );

    const triggers = screen.getAllByRole("button", { name: isSubsetTrigger });
    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toHaveAccessibleName(openLabel(AUTHOR));
    expect(triggers[0]).toHaveAttribute("aria-haspopup", "dialog");
    const plainLabel = screen.getByText("Fantasy");
    const unsupportedLabel = screen.getByText("Земномор'я");
    expect(plainLabel.closest("button")).toBeNull();
    expect(unsupportedLabel.closest("button")).toBeNull();
  });

  it("asks for no finished reads on render, hover or show-more", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TasteRankingList rows={SEVEN_ROWS.map(genreSubsetRow)} />);

    await user.hover(screen.getByRole("button", { name: openLabel("Fantasy") }));
    await user.click(screen.getByRole("button", { name: "Показати ще 4" }));

    expect(screen.getAllByRole("button", { name: isSubsetTrigger })).toHaveLength(7);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { expected: authorSubsetRequest(FIRST_QUARTER), period: FIRST_QUARTER, scope: "its period" },
    {
      expected: { authorId: statisticsIds.authorId, limit: "20", periodTo: "2026-03-31" },
      period: { from: null, to: "2026-03-31" },
      scope: "all time",
    },
  ])("asks once for exactly the row's subset over $scope", async ({ expected, period }) => {
    const user = userEvent.setup();
    renderWithProviders(<TasteRankingList rows={[authorRow(period)]} />);

    await user.click(screen.getByRole("button", { name: openLabel(AUTHOR) }));

    const dialog = await screen.findByRole("dialog", { name: dialogTitle(AUTHOR) });
    expect(await within(dialog).findByText("2 завершення")).toBeInTheDocument();
    expect(subsetRequests()).toEqual([expected]);
  });

  it("lists every read the server returned without re-filtering them by the row", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TasteRankingList rows={[authorRow()]} />);

    await user.click(screen.getByRole("button", { name: openLabel(AUTHOR) }));

    const dialog = await screen.findByRole("dialog", { name: dialogTitle(AUTHOR) });
    expect(await within(dialog).findByText("Чарівник Земномор'я")).toBeInTheDocument();
    expect(within(dialog).getByText("Гробниці Атуану")).toBeInTheDocument();
  });

  it("keeps the author link a separate tab stop beside the trigger, not inside it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TasteRankingList rows={[authorRow()]} />);
    const trigger = screen.getByRole("button", { name: openLabel(AUTHOR) });
    const link = screen.getByRole("link");

    expect(trigger).not.toContainElement(link);
    expect(link).not.toContainElement(trigger);
    expect(within(trigger).queryAllByRole("button")).toHaveLength(0);

    await user.tab();
    expect(trigger).toHaveFocus();
    await user.tab();
    expect(link).toHaveFocus();
  });

  it("opens from the keyboard and hands focus back to the trigger on Escape", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TasteRankingList rows={[authorRow()]} />);
    const trigger = screen.getByRole("button", { name: openLabel(AUTHOR) });

    await user.tab();
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog", { name: dialogTitle(AUTHOR) });
    await within(dialog).findByText("2 завершення");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("opens the subset in a popover that leaves the ranking reachable on desktop", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TasteRankingList rows={[authorRow()]} />);
    const trigger = screen.getByRole("button", { name: openLabel(AUTHOR) });

    await user.click(trigger);

    const popover = await screen.findByRole("dialog", { name: dialogTitle(AUTHOR) });
    await within(popover).findByText("2 завершення");
    expect(screen.getByRole("button", { name: openLabel(AUTHOR) })).toBe(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it("opens the subset in a modal drawer that hides the ranking behind it on mobile", async () => {
    vi.stubGlobal("innerWidth", 390);
    const user = userEvent.setup();
    renderWithProviders(<TasteRankingList rows={[authorRow()]} />);

    await user.click(screen.getByRole("button", { name: openLabel(AUTHOR) }));

    const drawer = await screen.findByRole("dialog", { name: dialogTitle(AUTHOR) });
    expect(await within(drawer).findByText("2 завершення")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: openLabel(AUTHOR) })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("closes the open subset when the row's period changes and reopens it for the new one", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(<TasteRankingList rows={[authorRow()]} />);

    await user.click(screen.getByRole("button", { name: openLabel(AUTHOR) }));
    const dialog = await screen.findByRole("dialog", { name: dialogTitle(AUTHOR) });
    await within(dialog).findByText("2 завершення");

    rerender(<TasteRankingList rows={[authorRow(SECOND_QUARTER)]} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(subsetRequests()).toEqual([authorSubsetRequest(FIRST_QUARTER)]);

    await user.click(screen.getByRole("button", { name: openLabel(AUTHOR) }));
    const reopened = await screen.findByRole("dialog", { name: dialogTitle(AUTHOR) });
    await within(reopened).findByText("2 завершення");

    expect(subsetRequests()).toEqual([
      authorSubsetRequest(FIRST_QUARTER),
      authorSubsetRequest(SECOND_QUARTER),
    ]);
  });
});
