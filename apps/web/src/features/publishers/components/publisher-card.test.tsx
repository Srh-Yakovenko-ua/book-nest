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

  it("shows the reading and buying counts", () => {
    renderWithProviders(
      <PublisherCard
        publisher={makePublisherListItem({
          stats: makePublisherStats({ readCount: 5, wantToBuyCount: 3 }),
        })}
      />,
    );

    expect(screen.getByText("Прочитано: 5")).toBeInTheDocument();
    expect(screen.getByText("Бажані: 3")).toBeInTheDocument();
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

    expect(screen.getByText("Країна невідома")).toBeInTheDocument();
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
