import type { ReadingStatisticsInsight } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { renderWithProviders, screen } from "@/test-utils";

import { statisticsIds } from "../../model/statistics.fixtures";
import { StatisticsInsightBody, StatisticsInsights } from "./statistics-insights";

function getInsightText(text: string): HTMLElement {
  return screen.getByText(
    (_, element) => element?.tagName === "P" && element.textContent?.replace(/\s/g, " ") === text,
  );
}

function render(items: ReadingStatisticsInsight[], isLowerBound = false) {
  return renderWithProviders(<StatisticsInsights insights={items} isLowerBound={isLowerBound} />);
}

const STREAK: ReadingStatisticsInsight = {
  category: "activity",
  code: "longest_streak_in_period",
  params: { days: 12, endDate: "2026-03-14", startDate: "2026-03-03" },
  tone: "positive",
};

const STREAK_SENTENCE =
  "Найдовша серія читання — 12 днів поспіль (з 3 березня 2026 р. по 14 березня 2026 р.).";

describe("StatisticsInsights", () => {
  it("localizes a weekday insight from its typed params", () => {
    render([
      {
        category: "activity",
        code: "most_active_weekday",
        params: { activeDays: 12, pagesRead: 1840, weekday: 1 },
        tone: "positive",
      },
    ]);

    expect(
      getInsightText("Найактивніший день тижня — понеділок: 12 активних днів і 1 840 сторінок."),
    ).toBeInTheDocument();
  });

  it("localizes a share as a percentage rather than a raw ratio", () => {
    render([
      {
        category: "genres",
        code: "top_genre_share",
        params: { completedReadCount: 14, genreKey: "fantasy", shareOfCompletedReads: 0.667 },
        tone: "neutral",
      },
    ]);

    expect(
      getInsightText("Найчастіший жанр періоду — fantasy: 14 читань, це 66,7% завершених читань."),
    ).toBeInTheDocument();
  });

  it("localizes the canonical language enum instead of showing it raw", () => {
    render([
      {
        category: "languages",
        code: "dominant_language",
        params: { completedReadCount: 21, language: "ukrainian", shareOfKnown: 0.84 },
        tone: "neutral",
      },
    ]);

    expect(screen.getByText(/Українська/)).toBeInTheDocument();
    expect(screen.queryByText(/ukrainian/)).not.toBeInTheDocument();
  });

  it("renders the backend order without reranking", () => {
    render([
      {
        category: "authors",
        code: "top_author_reads",
        params: { authorId: statisticsIds.authorId, authorName: "Ле Ґуїн", completedReadCount: 5 },
        tone: "neutral",
      },
      {
        category: "activity",
        code: "most_active_weekday",
        params: { activeDays: 3, pagesRead: 120, weekday: 3 },
        tone: "neutral",
      },
    ]);

    const rendered = screen.getAllByText(/Ле Ґуїн|Найактивніший день тижня/);

    expect(rendered[0]?.textContent).toContain("Ле Ґуїн");
    expect(rendered[1]?.textContent).toContain("Найактивніший день тижня");
  });

  it("never exposes a raw insight code as copy", () => {
    render([
      {
        category: "reading",
        code: "completed_reads_vs_comparison",
        params: {
          absoluteDelta: -4,
          comparisonValue: 12,
          currentValue: 8,
          percentDelta: -33.3,
        },
        tone: "negative",
      },
    ]);

    expect(screen.queryByText("completed_reads_vs_comparison")).not.toBeInTheDocument();
    expect(
      getInsightText("Ви завершили 8 читань — на 4 менше, ніж у періоді порівняння (12)."),
    ).toBeInTheDocument();
  });

  it("states an exact streak plainly when the history is complete", () => {
    render([STREAK]);

    expect(
      getInsightText(
        "Найдовша серія читання — 12 днів поспіль (з 3 березня 2026 р. по 14 березня 2026 р.).",
      ),
    ).toBeInTheDocument();
  });

  it("words a streak as a recorded minimum when the history is a lower bound", () => {
    render([STREAK], true);

    expect(
      getInsightText(
        "Найдовша зафіксована серія читання — щонайменше 12 днів поспіль (з 3 березня 2026 р. по 14 березня 2026 р.).",
      ),
    ).toBeInTheDocument();
  });

  it("highlights the key figure from the typed params", () => {
    render([STREAK]);

    expect(screen.getByText("12 днів", { selector: "strong" })).toBeInTheDocument();
  });

  it("sets the key figure in the heading face in the overview list", () => {
    render([STREAK]);

    expect(screen.getByText("12 днів", { selector: "strong" })).toHaveClass("font-heading");
  });

  it("mutes the sentence around the key figure in the overview list", () => {
    render([STREAK]);

    expect(getInsightText(STREAK_SENTENCE)).toHaveClass("text-muted-foreground");
  });

  it("renders no panel at all when nothing was selected", () => {
    const { container } = render([]);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("StatisticsInsightBody", () => {
  it("keeps the key figure in the body face when no emphasis is asked for", () => {
    renderWithProviders(<StatisticsInsightBody insight={STREAK} isLowerBound={false} />);

    expect(screen.getByText("12 днів", { selector: "strong" })).not.toHaveClass("font-heading");
  });

  it("keeps the sentence at full contrast when no emphasis is asked for", () => {
    renderWithProviders(<StatisticsInsightBody insight={STREAK} isLowerBound={false} />);

    const sentence = getInsightText(STREAK_SENTENCE);
    expect(sentence).toHaveClass("text-foreground");
    expect(sentence).not.toHaveClass("text-muted-foreground");
  });
});
