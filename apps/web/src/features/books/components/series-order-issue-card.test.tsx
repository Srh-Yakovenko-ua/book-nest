import "@testing-library/jest-dom/vitest";

import type { SeriesOrderProblemType } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import {
  AFFECTED_BOOK_TITLE,
  makeSeriesOrderBook,
  makeSeriesOrderCover,
  makeSeriesOrderIssue,
  PREVIOUS_BOOK_TITLE,
} from "../model/series-order-check.fixtures";
import { SeriesOrderIssueCard } from "./series-order-issue-card";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const soc = messages.readingQueue.seriesOrderCheck;
const actions = soc.actions;
const card = soc.card;

type IssueOverrides = Parameters<typeof makeSeriesOrderIssue>[0];

function renderCard(overrides: IssueOverrides = {}, { pending = false } = {}) {
  const onAction = vi.fn();
  const issue = makeSeriesOrderIssue(overrides);
  renderWithProviders(<SeriesOrderIssueCard issue={issue} onAction={onAction} pending={pending} />);
  return { issue, onAction };
}

describe("SeriesOrderIssueCard problem texts", () => {
  it.each([
    [
      "missing_previous_from_queue",
      `Перед «${AFFECTED_BOOK_TITLE}» ще не завершено «${PREVIOUS_BOOK_TITLE}».`,
    ],
    [
      "previous_book_after_later_book",
      `«${PREVIOUS_BOOK_TITLE}» має бути раніше за «${AFFECTED_BOOK_TITLE}».`,
    ],
    ["previous_book_paused", "Попередня частина ще не завершена."],
    ["current_reading_ahead_of_order", "Поточне читання випереджає порядок серії."],
    ["previous_book_want_to_buy", "Попередня частина ще не придбана."],
    ["previous_book_not_owned", "Попередньої частини немає у власній бібліотеці."],
    ["previous_book_in_transit", "Попередня частина вже в дорозі."],
    ["previous_book_lent_out", "Попередня частина позичена комусь і зараз недоступна."],
    ["multiple_books_out_of_order", "У серії переплутано порядок."],
  ] as const satisfies readonly [SeriesOrderProblemType, string][])(
    "explains the %s problem",
    (problemType, expected) => {
      renderCard({ problemType });

      expect(screen.getByText(expected)).toBeInTheDocument();
    },
  );

  it("explains how many previous books are still unresolved", () => {
    renderCard({ problemType: "multiple_previous_missing", unresolvedPreviousCount: 3 });

    expect(
      screen.getByText(`Перед «${AFFECTED_BOOK_TITLE}» залишилося 3 незакриті частини.`),
    ).toBeInTheDocument();
  });

  it.each([
    [1, "1 незакрита частина"],
    [3, "3 незакриті частини"],
    [5, "5 незакритих частин"],
  ])("pluralises %i unresolved previous books", (count, expected) => {
    renderCard({ problemType: "multiple_previous_missing", unresolvedPreviousCount: count });

    expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();
  });

  it.each([
    [
      "current_reading_ahead_of_order",
      `Зараз читається «${AFFECTED_BOOK_TITLE}», хоча «${PREVIOUS_BOOK_TITLE}» ще не завершена.`,
    ],
    [
      "previous_book_paused",
      `«${PREVIOUS_BOOK_TITLE}» на паузі, а «${AFFECTED_BOOK_TITLE}» уже попереду.`,
    ],
  ] as const satisfies readonly [SeriesOrderProblemType, string][])(
    "adds a description line for the %s problem",
    (problemType, expected) => {
      renderCard({ problemType });

      expect(screen.getByText(expected)).toBeInTheDocument();
    },
  );

  it("shows the number of other conflicts in the same series", () => {
    renderCard({
      relatedProblems: [
        { affectedBookId: "book-3", previousBookId: "book-2", problemType: "previous_book_paused" },
        {
          affectedBookId: "book-4",
          previousBookId: "book-3",
          problemType: "missing_previous_from_queue",
        },
      ],
    });

    expect(screen.getByText("Ще 2 конфлікти у цій серії")).toBeInTheDocument();
  });

  it("omits the related conflicts line when the series has a single problem", () => {
    renderCard({ relatedProblems: [] });

    expect(screen.queryByText(/конфлікт/)).not.toBeInTheDocument();
  });
});

describe("SeriesOrderIssueCard severity", () => {
  it.each([
    ["error", soc.severity.error],
    ["warning", soc.severity.warning],
    ["info", soc.severity.info],
  ] as const)("labels the %s severity in text, not colour alone", (severity, label) => {
    renderCard({ severity });

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe("SeriesOrderIssueCard books", () => {
  it("links the series title to the series page", () => {
    renderCard({ series: { id: "series-42", title: "Відьмак" } });

    expect(screen.getByRole("link", { name: "Відьмак" })).toHaveAttribute(
      "href",
      "/series/series-42",
    );
  });

  it("shows the affected and the previous book with their labels", () => {
    renderCard();

    expect(screen.getByText(card.affectedBook)).toBeInTheDocument();
    expect(screen.getByText(card.previousBook)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: AFFECTED_BOOK_TITLE })).toHaveAttribute(
      "href",
      "/books/book-affected",
    );
  });

  it("omits the previous book row when the backend sent none", () => {
    renderCard({ allowedActions: ["REORDER_SERIES_SLOTS"], previousBook: null });

    expect(screen.queryByText(card.previousBook)).not.toBeInTheDocument();
  });

  it("shows the series position and the queue position of a queued book", () => {
    renderCard({
      affectedBook: makeSeriesOrderBook({ queuePosition: 4, seriesPosition: 2 }),
      previousBook: null,
    });

    expect(screen.getByText("Книга 2 · Позиція в черзі: 4")).toBeInTheDocument();
  });

  it("marks a book that is not in the queue", () => {
    renderCard({
      affectedBook: makeSeriesOrderBook({ queuePosition: null, seriesPosition: 2 }),
      previousBook: null,
    });

    expect(screen.getByText(`Книга 2 · ${card.notInQueue}`)).toBeInTheDocument();
  });

  it("marks the book that is being read right now", () => {
    renderCard({
      affectedBook: makeSeriesOrderBook({ isCurrentReading: true, queuePosition: 1 }),
      previousBook: null,
    });

    expect(screen.getByText(`Книга 2 · ${card.currentReading}`)).toBeInTheDocument();
  });

  it("falls back to an unknown series position", () => {
    renderCard({
      affectedBook: makeSeriesOrderBook({ seriesPosition: null }),
      previousBook: null,
    });

    expect(screen.getByText(new RegExp(card.seriesPositionUnknown))).toBeInTheDocument();
  });

  it("shows the cover with a descriptive alt text", () => {
    renderCard({
      affectedBook: makeSeriesOrderBook({ cover: makeSeriesOrderCover() }),
      previousBook: null,
    });

    expect(
      screen.getByRole("img", { name: `Обкладинка «${AFFECTED_BOOK_TITLE}»` }),
    ).toBeInTheDocument();
  });

  it("renders no image when the book has no cover", () => {
    renderCard({ previousBook: null });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("clamps a very long book title instead of overflowing", () => {
    const longTitle = "Дуже довга назва книги серії про пригоди героя ".repeat(6).trim();
    renderCard({
      affectedBook: makeSeriesOrderBook({ title: longTitle }),
      previousBook: null,
    });

    expect(screen.getByRole("link", { name: longTitle })).toHaveClass("line-clamp-2");
  });
});

describe("SeriesOrderIssueCard order preview", () => {
  it("shows the current and the recommended order of the series", () => {
    renderCard();

    expect(screen.getByText(soc.preview.current)).toBeInTheDocument();
    expect(screen.getByText(soc.preview.recommended)).toBeInTheDocument();
  });

  it("lists the recommended order in the sequence the backend sent", () => {
    renderCard();

    const lists = screen.getAllByRole("list");
    const recommended = lists[lists.length - 1];
    const titles = Array.from(recommended?.querySelectorAll("li") ?? []).map((li) =>
      li.textContent?.replace(/\d+\.\s*/, "").trim(),
    );

    expect(titles?.[0]).toContain(PREVIOUS_BOOK_TITLE);
    expect(titles?.[1]).toContain(AFFECTED_BOOK_TITLE);
  });

  it("omits an empty sequence", () => {
    renderCard({ currentOrder: [], recommendedOrder: [] });

    expect(screen.queryByText(soc.preview.current)).not.toBeInTheDocument();
    expect(screen.queryByText(soc.preview.recommended)).not.toBeInTheDocument();
  });
});

describe("SeriesOrderIssueCard actions", () => {
  it("renders only the actions the backend allows", () => {
    renderCard({ allowedActions: ["ADD_ALL_PREVIOUS_BEFORE"] });

    expect(screen.getByRole("button", { name: actions.addAll })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: actions.ignore })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Більше дій/ })).not.toBeInTheDocument();
  });

  it("hides a fix action the backend did not allow", () => {
    renderCard({ allowedActions: ["ADD_NEXT_PREVIOUS_BEFORE"] });

    expect(screen.queryByRole("button", { name: actions.arrangeBySeries })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: actions.addAll })).not.toBeInTheDocument();
  });

  it("names the insert action after the affected book", () => {
    renderCard({ allowedActions: ["ADD_NEXT_PREVIOUS_BEFORE"] });

    expect(
      screen.getByRole("button", { name: `Додати перед «${AFFECTED_BOOK_TITLE}»` }),
    ).toBeInTheDocument();
  });

  it("reports the chosen fix action to the caller", async () => {
    const { onAction } = renderCard({ allowedActions: ["REORDER_SERIES_SLOTS"] });

    await userEvent.click(screen.getByRole("button", { name: actions.fixOrder }));

    expect(onAction).toHaveBeenCalledWith("REORDER_SERIES_SLOTS");
  });

  it.each([
    ["OPEN_PREVIOUS_BOOK", actions.openBook],
    ["RESUME_PREVIOUS_BOOK", actions.resumeBook],
    ["OPEN_PURCHASE", actions.openPurchase],
    ["OPEN_ORDER", actions.openOrder],
    ["OPEN_LOAN", actions.openLoan],
  ] as const)("renders %s as a link to the previous book", (code, label) => {
    renderCard({ allowedActions: [code] });

    expect(screen.getByRole("link", { name: label })).toHaveAttribute(
      "href",
      "/books/book-previous",
    );
  });

  it("offers the wishlist action as a button rather than a link", async () => {
    const { onAction } = renderCard({
      allowedActions: ["ADD_PREVIOUS_TO_WISHLIST"],
      problemType: "previous_book_not_owned",
    });

    await userEvent.click(screen.getByRole("button", { name: actions.addToWishlist }));

    expect(onAction).toHaveBeenCalledWith("ADD_PREVIOUS_TO_WISHLIST");
  });

  it("reports the ignore action to the caller", async () => {
    const { onAction } = renderCard({ allowedActions: ["IGNORE_ISSUE"] });

    await userEvent.click(screen.getByRole("button", { name: actions.ignore }));

    expect(onAction).toHaveBeenCalledWith("IGNORE_ISSUE");
  });

  it("reports the disable action chosen from the overflow menu", async () => {
    const { onAction } = renderCard({ allowedActions: ["DISABLE_SERIES_CHECK"] });

    await userEvent.click(
      screen.getByRole("button", { name: `Більше дій для серії «Тестова серія»` }),
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: actions.disableSeries }));

    expect(onAction).toHaveBeenCalledWith("DISABLE_SERIES_CHECK");
  });

  it("names the overflow trigger after its series for screen readers", () => {
    renderCard({ series: { id: "series-9", title: "Дюна" } });

    expect(screen.getByRole("button", { name: "Більше дій для серії «Дюна»" })).toBeInTheDocument();
  });

  it("opens the overflow menu from the keyboard", async () => {
    renderCard({ allowedActions: ["DISABLE_SERIES_CHECK"] });

    await userEvent.tab();
    await userEvent.keyboard("{Enter}");

    expect(
      await screen.findByRole("menuitem", { name: actions.disableSeries }),
    ).toBeInTheDocument();
  });

  it("disables the actions of an issue that is being resolved", () => {
    renderCard({ allowedActions: ["REORDER_SERIES_SLOTS", "IGNORE_ISSUE"] }, { pending: true });

    expect(screen.getByRole("button", { name: actions.fixOrder })).toBeDisabled();
    expect(screen.getByRole("button", { name: actions.ignore })).toBeDisabled();
  });
});
