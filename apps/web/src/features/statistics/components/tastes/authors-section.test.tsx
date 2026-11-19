import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { overviewFixture, statisticsIds } from "../../model/statistics.fixtures";
import { AuthorsSection } from "./authors-section";

const { authors } = overviewFixture();

function frequencyRow(name: string, completedReadCount: number) {
  const [row] = authors.frequency;
  if (row === undefined) throw new Error("fixture must expose one author row");
  return { ...row, authorId: name, completedReadCount, name };
}

function subsetOpenLabel(name: string): string {
  return messages.statistics.details.subset.open.replace("{name}", name);
}

describe("AuthorsSection", () => {
  it("scores a rated author against the ten-point scale", async () => {
    renderWithProviders(
      <AuthorsSection
        authors={{
          ...authors,
          topRated: {
            availability: "available",
            items: [
              {
                authorId: statisticsIds.authorId,
                averageRating: 8,
                name: "Ursula K. Le Guin",
                ratedReadCount: 3,
              },
            ],
          },
        }}
      />,
    );

    await userEvent.click(
      screen.getByRole("radio", { name: messages.statistics.authors.modes.rated }),
    );

    expect(screen.getByText("8,0 / 10")).toBeInTheDocument();
    const bar = screen.getByRole("listitem").querySelector<HTMLElement>("[style*='width']");
    expect(bar?.style.width).toBe("80%");
  });

  it("explains when the rated ranking has too few ratings", async () => {
    renderWithProviders(<AuthorsSection authors={authors} />);

    await userEvent.click(
      screen.getByRole("radio", { name: messages.statistics.authors.modes.rated }),
    );

    expect(screen.getByText("Поки немає достатньо даних для рейтингу")).toBeInTheDocument();
    expect(
      screen.getByText("Автор потрапляє в рейтинг, коли має щонайменше 3 оцінені читання."),
    ).toBeInTheDocument();
  });

  it("keeps the mode switch usable when the rated ranking has too few ratings", async () => {
    renderWithProviders(<AuthorsSection authors={authors} />);

    await userEvent.click(
      screen.getByRole("radio", { name: messages.statistics.authors.modes.rated }),
    );

    for (const mode of screen.getAllByRole("radio")) {
      expect(mode).toBeEnabled();
    }
    await userEvent.click(
      screen.getByRole("radio", { name: messages.statistics.authors.modes.frequency }),
    );
    expect(screen.getByText("2 читання")).toBeInTheDocument();
  });

  it("shows partial coverage once, as the description, with no footer note", () => {
    renderWithProviders(
      <AuthorsSection
        authors={{
          ...authors,
          availability: "partial",
          coverage: { eligibleCount: 6, knownCount: 4, percent: 0.667 },
        }}
      />,
    );

    expect(screen.getAllByText("Автор відомий для 4 із 6 читань")).toHaveLength(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("4 із 6 читань мають збереженого автора")).not.toBeInTheDocument();
  });

  it("shows neither a generic description nor a coverage text when every read has an author", () => {
    renderWithProviders(<AuthorsSection authors={authors} />);

    expect(screen.queryByText("Автори завершених читань періоду.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Автор відомий для/)).not.toBeInTheDocument();
  });

  it("marks the returning author's years and reads as all-time figures", () => {
    const [allTimeMarker = ""] = messages.statistics.authors.returningMeta.split(" · ");
    renderWithProviders(
      <AuthorsSection
        authors={{
          ...authors,
          returning: {
            availability: "available",
            items: [
              {
                authorId: statisticsIds.authorId,
                completedReadCount: 11,
                distinctReadingYears: 4,
                latestFinishedAt: "2026-03-14",
                name: "Ursula K. Le Guin",
              },
            ],
          },
        }}
      />,
    );

    expect(
      screen.getByText(`${allTimeMarker} · 4 роки · 11 читань · востаннє 14 бер.`),
    ).toBeInTheDocument();
  });

  it("opens finished reads from a frequency row but never from the all-time returning author", () => {
    renderWithProviders(
      <AuthorsSection
        authors={{
          ...authors,
          returning: {
            availability: "available",
            items: [
              {
                authorId: statisticsIds.authorId,
                completedReadCount: 11,
                distinctReadingYears: 4,
                latestFinishedAt: "2026-03-14",
                name: "Ursula K. Le Guin",
              },
            ],
          },
        }}
      />,
    );

    const trigger = screen.getByRole("button", { name: subsetOpenLabel("Урсула Ле Ґуїн") });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    const returningName = screen.getByText("Ursula K. Le Guin");
    expect(returningName.closest("button")).toBeNull();
    const returningLabel = subsetOpenLabel("Ursula K. Le Guin");
    expect(screen.queryByRole("button", { name: returningLabel })).not.toBeInTheDocument();
  });

  it("fills a frequency bar to the author's share of every read finished in the period", () => {
    renderWithProviders(
      <AuthorsSection
        authors={{
          ...authors,
          coverage: { eligibleCount: 6, knownCount: 4, percent: 0.667 },
          frequency: [
            frequencyRow("Ursula K. Le Guin", 1),
            frequencyRow("Terry Pratchett", 1),
            frequencyRow("Octavia E. Butler", 1),
          ],
        }}
      />,
    );

    const widths = within(screen.getByRole("list"))
      .getAllByRole("listitem")
      .map((row) =>
        Number.parseFloat(row.querySelector<HTMLElement>("[style*='width']")?.style.width ?? ""),
      );
    expect(widths).toHaveLength(3);
    for (const width of widths) {
      expect(width).toBeCloseTo(16.67, 2);
    }
  });

  it("states each author's share of every read finished in the period", () => {
    renderWithProviders(
      <AuthorsSection
        authors={{
          ...authors,
          coverage: { eligibleCount: 6, knownCount: 4, percent: 0.667 },
          frequency: [
            frequencyRow("Ursula K. Le Guin", 1),
            frequencyRow("Terry Pratchett", 1),
            frequencyRow("Octavia E. Butler", 1),
          ],
        }}
      />,
    );

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row).toHaveTextContent(messages.statistics.authors.share.replace("{percent}", "16,7"));
    }
  });

  it("shows all five authors with no show-more control", () => {
    renderWithProviders(
      <AuthorsSection
        authors={{
          ...authors,
          coverage: { eligibleCount: 15, knownCount: 15, percent: 1 },
          frequency: [
            frequencyRow("Ursula K. Le Guin", 5),
            frequencyRow("Terry Pratchett", 4),
            frequencyRow("Octavia E. Butler", 3),
            frequencyRow("Ted Chiang", 2),
            frequencyRow("N. K. Jemisin", 1),
          ],
        }}
      />,
    );

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row).not.toHaveClass("hidden");
    }
    expect(screen.queryByRole("button", { name: /Показати ще/ })).not.toBeInTheDocument();
  });
});
