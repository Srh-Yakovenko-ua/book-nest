import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { makePublisherListItem, makePublisherStats } from "../model/publisher.fixtures";
import { PublisherRow } from "./publisher-row";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe("PublisherRow", () => {
  it("links the publisher name to its detail page", () => {
    renderWithProviders(
      <PublisherRow publisher={makePublisherListItem({ id: "vivat", name: "Vivat" })} />,
    );

    expect(screen.getByRole("link", { name: "Vivat" })).toHaveAttribute(
      "href",
      "/publishers/vivat",
    );
  });

  it("marks a custom publisher as own", () => {
    renderWithProviders(<PublisherRow publisher={makePublisherListItem({ isCustom: true })} />);

    expect(screen.getByText("Власне")).toBeInTheDocument();
  });

  it("shows no source marker for a global publisher", () => {
    renderWithProviders(<PublisherRow publisher={makePublisherListItem({ isCustom: false })} />);

    expect(screen.queryByText("Власне")).not.toBeInTheDocument();
    expect(screen.queryByText("Загальне")).not.toBeInTheDocument();
  });

  it("renders the metric blocks in order without a table", () => {
    renderWithProviders(
      <PublisherRow
        publisher={makePublisherListItem({
          stats: makePublisherStats({
            booksCount: 8,
            readCount: 5,
            seriesCount: 2,
            wantToBuyCount: 3,
          }),
        })}
      />,
    );

    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Книги",
      "Прочитано",
      "Список бажань",
      "Серії",
      "Рейтинг",
      "Останнє поповнення",
    ]);
    expect(screen.getByText("Серії").nextElementSibling).toHaveTextContent("2");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the no-rating copy for an unrated publisher", () => {
    renderWithProviders(
      <PublisherRow
        publisher={makePublisherListItem({
          stats: makePublisherStats({
            averageRating: null,
            lastBookAddedAt: "2026-03-01T00:00:00.000Z",
            ratedBooksCount: 0,
          }),
        })}
      />,
    );

    expect(screen.getByText("Рейтинг")).toBeInTheDocument();
    expect(screen.getByText("Без оцінок")).toBeInTheDocument();
  });

  it("labels an unknown country when the code is missing", () => {
    renderWithProviders(<PublisherRow publisher={makePublisherListItem({ countryCode: null })} />);

    expect(screen.getByText("Без країни")).toBeInTheDocument();
  });
});
