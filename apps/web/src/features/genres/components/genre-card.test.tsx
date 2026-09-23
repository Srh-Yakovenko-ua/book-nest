import "@testing-library/jest-dom/vitest";

import type { ComponentProps } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeGenreStats } from "../model/genres.fixtures";
import { GenreCard } from "./genre-card";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

const COVERS = ["/c1.jpg", "/c2.jpg", "/c3.jpg", "/c4.jpg"];

describe("GenreCard", () => {
  it("is one Library link carrying only the genre", () => {
    const { container } = renderWithProviders(<GenreCard genre={makeGenreStats()} />);

    expect(within(container).getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Фентезі" })).toHaveAttribute(
      "href",
      "/books?genre=fantasy",
    );
    expect(within(container).queryByRole("button")).not.toBeInTheDocument();
  });

  it("follows the link with the keyboard like any native link", async () => {
    renderWithProviders(<GenreCard genre={makeGenreStats()} />);

    await userEvent.tab();

    expect(screen.getByRole("link", { name: "Фентезі" })).toHaveFocus();
  });

  it("reports read progress as a progress bar and the queue beside it", () => {
    renderWithProviders(
      <GenreCard genre={makeGenreStats({ booksCount: 43, readCount: 18, readingQueueCount: 1 })} />,
    );

    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "42");
    expect(progress).toHaveAttribute("aria-valuetext", "Прочитано 18 з 43");
    expect(screen.getByText("1 у черзі")).toBeInTheDocument();
  });

  it("leaves out the queue when nothing of the genre waits in it", () => {
    renderWithProviders(<GenreCard genre={makeGenreStats({ readingQueueCount: 0 })} />);

    expect(screen.queryByText(/у черзі/)).not.toBeInTheDocument();
  });

  it("shows no rating until a book of the genre is rated", () => {
    renderWithProviders(<GenreCard genre={makeGenreStats()} />);

    expect(screen.queryByText(/Середня оцінка/)).not.toBeInTheDocument();
  });

  it("shows the average from a single rated book and describes its sample", () => {
    renderWithProviders(
      <GenreCard genre={makeGenreStats({ averageRating: 8.64, ratedBooksCount: 1 })} />,
    );

    expect(screen.getByText("8,6")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Фентезі" })).toHaveAccessibleDescription(
      "Середня оцінка 8,6 · 1 оцінена книга",
    );
  });

  it("names the progress bar by its visible progress text", () => {
    renderWithProviders(<GenreCard genre={makeGenreStats({ booksCount: 43, readCount: 18 })} />);

    expect(screen.getByRole("progressbar")).toHaveAccessibleName("Прочитано 18 з 43");
  });

  it("keeps the rating out of the way of the card link", () => {
    renderWithProviders(
      <GenreCard genre={makeGenreStats({ averageRating: 8.64, ratedBooksCount: 1 })} />,
    );

    const rating = ratingElement();
    expect(rating).toHaveClass("pointer-events-none");
    expect(rating).not.toHaveClass("z-10");
  });

  it("shows the rating context when the pointer rests over the rating", async () => {
    renderWithProviders(
      <GenreCard genre={makeGenreStats({ averageRating: 8.64, ratedBooksCount: 1 })} />,
    );
    const rating = ratingElement();
    vi.spyOn(rating, "getBoundingClientRect").mockReturnValue(new DOMRect(200, 10, 40, 20));
    const link = screen.getByRole("link", { name: "Фентезі" });

    await userEvent.pointer({ coords: { clientX: 20, clientY: 20 }, target: link });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await userEvent.pointer({ coords: { clientX: 210, clientY: 20 }, target: link });
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Середня оцінка 8,6 · 1 оцінена книга",
    );

    await userEvent.unhover(link);
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("shows the rating context to keyboard users on the card link", async () => {
    renderWithProviders(
      <GenreCard genre={makeGenreStats({ averageRating: 8.64, ratedBooksCount: 1 })} />,
    );

    await userEvent.tab();

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Середня оцінка 8,6 · 1 оцінена книга",
    );
  });

  it("previews four covers and counts the other books", () => {
    renderWithProviders(
      <GenreCard genre={makeGenreStats({ booksCount: 66, coverUrls: COVERS })} />,
    );

    expect(document.querySelectorAll("img")).toHaveLength(4);
    expect(screen.getByText("+62")).toBeInTheDocument();
  });

  it("uses a single placeholder when no book has a cover", () => {
    renderWithProviders(<GenreCard genre={makeGenreStats({ booksCount: 8, coverUrls: [] })} />);

    expect(document.querySelectorAll('[data-slot="genre-cover-placeholder"]')).toHaveLength(1);
    expect(document.querySelectorAll("img")).toHaveLength(0);
    expect(screen.getByText("+7")).toBeInTheDocument();
  });
});

function ratingElement(): HTMLElement {
  const rating = document.querySelector<HTMLElement>('[data-slot="genre-card-rating"]');
  if (rating === null) throw new Error("rating is not rendered");
  return rating;
}
