import type { ReadingStatisticsGenresSection } from "@app/shared";
import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { overviewFixture } from "../../model/statistics.fixtures";
import { GenresSection } from "./genres-section";

const { genres } = overviewFixture();

function barPercents(): number[] {
  return within(screen.getByRole("list"))
    .getAllByRole("listitem")
    .map((row) => {
      const bar = row.querySelector<HTMLElement>("[style*='width']");
      if (bar === null) throw new Error("every ranking row draws a bar");
      return Number.parseFloat(bar.style.width);
    });
}

function genreRow(genreKey: string) {
  const [row] = genres.frequency;
  if (row === undefined) throw new Error("fixture must expose one genre row");
  return { ...row, genreKey };
}

function subsetOpenLabel(name: string): string {
  return messages.statistics.details.subset.open.replace("{name}", name);
}

function withFrequency(
  frequency: ReadingStatisticsGenresSection["frequency"],
): ReadingStatisticsGenresSection {
  return { ...genres, frequency };
}

const GENRES_RESPONSE = [
  {
    groupKey: "fiction",
    groupName: "Художня",
    id: "genre-fantasy",
    isDefault: true,
    key: "fantasy",
    name: "Фентезі",
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(GENRES_RESPONSE), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GenresSection", () => {
  it("shows the localized genre name and falls back to the key for unknown genres", async () => {
    renderWithProviders(
      <GenresSection genres={withFrequency([genreRow("fantasy"), genreRow("custom-genre")])} />,
    );

    expect(await screen.findByText("Фентезі")).toBeInTheDocument();
    expect(screen.getByText("custom-genre")).toBeInTheDocument();
  });

  it("labels the cycle count as reads, not books", () => {
    renderWithProviders(<GenresSection genres={genres} />);

    expect(screen.getByText("2 читання")).toBeInTheDocument();
    expect(screen.queryByText("2 книги")).not.toBeInTheDocument();
  });

  it("keeps the backend ranking order without re-sorting by label", () => {
    renderWithProviders(
      <GenresSection
        genres={withFrequency([genreRow("фентезі"), genreRow("детектив"), genreRow("аніме")])}
      />,
    );

    const rows = screen.getAllByText(/фентезі|детектив|аніме/);

    expect(rows.map((row) => row.textContent)).toEqual(["фентезі", "детектив", "аніме"]);
  });

  it("opens a frequency row's finished reads from its label and adds no links", async () => {
    renderWithProviders(<GenresSection genres={genres} />);

    const list = screen.getByRole("list");

    const trigger = await within(list).findByRole("button", { name: subsetOpenLabel("Фентезі") });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(within(list).getAllByRole("button")).toHaveLength(1);
    expect(within(list).queryAllByRole("link")).toHaveLength(0);
  });

  it("keeps rated rows unclickable even for a genre whose reads can be opened", async () => {
    renderWithProviders(
      <GenresSection
        genres={{
          ...genres,
          topRated: {
            availability: "available",
            items: [{ averageRating: 8, genreKey: "fantasy", ratedReadCount: 3 }],
          },
        }}
      />,
    );
    expect(await screen.findByRole("button", { name: subsetOpenLabel("Фентезі") })).toBeVisible();

    await userEvent.click(screen.getByRole("radio", { name: "Найвище оцінюю" }));

    expect(screen.getByText("8,0 / 10")).toBeInTheDocument();
    expect(within(screen.getByRole("list")).queryAllByRole("button")).toHaveLength(0);
  });

  it("shows the typed insufficient-sample reason instead of an empty ranking", async () => {
    renderWithProviders(<GenresSection genres={genres} />);

    await userEvent.click(screen.getByRole("radio", { name: "Найвище оцінюю" }));

    expect(screen.getByText("Поки немає достатньо даних для рейтингу")).toBeInTheDocument();
    expect(
      screen.getByText("Жанр потрапляє в рейтинг, коли має щонайменше 3 оцінені читання."),
    ).toBeInTheDocument();
  });

  it("keeps the mode switch usable when the rated ranking has too few ratings", async () => {
    renderWithProviders(<GenresSection genres={genres} />);

    await userEvent.click(screen.getByRole("radio", { name: "Найвище оцінюю" }));

    for (const mode of screen.getAllByRole("radio")) {
      expect(mode).toBeEnabled();
    }
    await userEvent.click(
      screen.getByRole("radio", { name: messages.statistics.genres.modes.frequency }),
    );
    expect(screen.getByText("2 читання")).toBeInTheDocument();
  });

  it("shows partial coverage once, as the description, with no footer note", () => {
    renderWithProviders(
      <GenresSection
        genres={{
          ...genres,
          availability: "partial",
          coverage: { eligibleCount: 10, knownCount: 6, percent: 0.6 },
        }}
      />,
    );

    expect(screen.getAllByText("Жанри відомі для 6 із 10 читань")).toHaveLength(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("6 із 10 читань мають збережений жанр")).not.toBeInTheDocument();
  });

  it("shows neither a generic description nor a coverage text when every read has a genre", () => {
    renderWithProviders(<GenresSection genres={genres} />);

    expect(screen.queryByText("Жанри завершених читань періоду.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Жанри відомі для/)).not.toBeInTheDocument();
  });

  it("shows an honest empty ranking for a period with no genres", () => {
    renderWithProviders(<GenresSection genres={withFrequency([])} />);

    expect(screen.getByText("У завершених читаннях періоду немає жанрів.")).toBeInTheDocument();
  });

  it("scores a rated genre against the ten-point scale", async () => {
    renderWithProviders(
      <GenresSection
        genres={{
          ...genres,
          topRated: {
            availability: "available",
            items: [{ averageRating: 8, genreKey: "fantasy", ratedReadCount: 3 }],
          },
        }}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Найвище оцінюю" }));

    expect(screen.getByText("8,0 / 10")).toBeInTheDocument();
    const bar = screen.getByRole("listitem").querySelector<HTMLElement>("[style*='width']");
    expect(bar?.style.width).toBe("80%");
  });

  it("fills a frequency bar to the genre's share of every finished read, not to the top genre", () => {
    renderWithProviders(
      <GenresSection
        genres={withFrequency([
          { ...genreRow("fantasy"), completedReadCount: 2, shareOfCompletedReads: 1 / 3 },
          { ...genreRow("mystery"), completedReadCount: 1, shareOfCompletedReads: 1 / 6 },
        ])}
      />,
    );

    const [fantasy, mystery] = barPercents();
    expect(fantasy).toBeCloseTo(33.33, 2);
    expect(mystery).toBeCloseTo(16.67, 2);
  });

  it("lets overlapping genres fill more than 100% between them", () => {
    renderWithProviders(
      <GenresSection
        genres={withFrequency([
          { ...genreRow("fantasy"), completedReadCount: 4, shareOfCompletedReads: 2 / 3 },
          { ...genreRow("mystery"), completedReadCount: 2, shareOfCompletedReads: 1 / 3 },
          { ...genreRow("horror"), completedReadCount: 2, shareOfCompletedReads: 1 / 3 },
        ])}
      />,
    );

    const [fantasy, mystery, horror] = barPercents();
    expect(fantasy).toBeCloseTo(66.67, 2);
    expect(mystery).toBeCloseTo(33.33, 2);
    expect(horror).toBeCloseTo(33.33, 2);
  });

  it("shows all five genres with no show-more control", () => {
    renderWithProviders(
      <GenresSection
        genres={withFrequency(["fantasy", "mystery", "horror", "romance", "poetry"].map(genreRow))}
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
