import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { makePublisherListItem, makePublisherStats } from "../model/publisher.fixtures";
import { PublisherCard } from "./publisher-card";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe("PublisherCard", () => {
  it("links the publisher name to its detail page", () => {
    renderWithProviders(
      <PublisherCard publisher={makePublisherListItem({ id: "vivat", name: "Vivat" })} />,
    );

    expect(screen.getByRole("link", { name: "Vivat" })).toHaveAttribute(
      "href",
      "/publishers/vivat",
    );
  });

  it("shows the book count and exactly the read, wishlist and series metrics", () => {
    renderWithProviders(
      <PublisherCard
        publisher={makePublisherListItem({
          stats: makePublisherStats({
            booksCount: 8,
            queueCount: 7,
            readCount: 5,
            readingCount: 6,
            seriesCount: 2,
            wantToBuyCount: 3,
            wantToReadCount: 9,
          }),
        })}
      />,
    );

    expect(screen.getByText("8 книг")).toBeInTheDocument();
    expect(screen.getByText("у бібліотеці")).toBeInTheDocument();
    expect(screen.getByText("Прочитано").nextElementSibling).toHaveTextContent("5");
    expect(screen.getByText("У списку бажань").nextElementSibling).toHaveTextContent("3");
    expect(screen.getByText("Серії").nextElementSibling).toHaveTextContent("2");
    expect(screen.getAllByRole("term")).toHaveLength(3);
    expect(screen.queryByText("6")).not.toBeInTheDocument();
    expect(screen.queryByText("7")).not.toBeInTheDocument();
    expect(screen.queryByText("9")).not.toBeInTheDocument();
    expect(screen.queryByText(/Бажані/)).not.toBeInTheDocument();
  });

  it("shows the rating with its count and the last addition date", () => {
    renderWithProviders(
      <PublisherCard
        publisher={makePublisherListItem({
          stats: makePublisherStats({ averageRating: 4.3, ratedBooksCount: 12 }),
        })}
      />,
    );

    expect(screen.getByText("4,3")).toBeInTheDocument();
    expect(screen.getByText("· 12 оцінок")).toBeInTheDocument();
    expect(screen.getByText(/^Останнє поповнення /)).toBeInTheDocument();
  });

  it("shows a dash when no book was ever added and drops the view link", () => {
    renderWithProviders(
      <PublisherCard
        publisher={makePublisherListItem({ stats: makePublisherStats({ lastBookAddedAt: null }) })}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Переглянути")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("shows the no-rating copy instead of a fake number for an unrated publisher", () => {
    renderWithProviders(
      <PublisherCard
        publisher={makePublisherListItem({
          stats: makePublisherStats({ averageRating: null, ratedBooksCount: 0 }),
        })}
      />,
    );

    expect(screen.getByText("Без оцінок")).toBeInTheDocument();
  });

  it("labels an unknown country when the code is missing", () => {
    renderWithProviders(<PublisherCard publisher={makePublisherListItem({ countryCode: null })} />);

    expect(screen.getByText("Без країни")).toBeInTheDocument();
  });

  it("badges a custom publisher", () => {
    renderWithProviders(<PublisherCard publisher={makePublisherListItem({ isCustom: true })} />);

    expect(screen.getByText("Власне")).toBeInTheDocument();
  });

  it("leaves a global publisher without the custom badge", () => {
    renderWithProviders(<PublisherCard publisher={makePublisherListItem({ isCustom: false })} />);

    expect(screen.queryByText("Власне")).not.toBeInTheDocument();
  });
});
