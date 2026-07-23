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
    expect(screen.queryByText("Загальне")).not.toBeInTheDocument();
  });

  it("marks a global publisher as shared", () => {
    renderWithProviders(<PublisherRow publisher={makePublisherListItem({ isCustom: false })} />);

    expect(screen.getByText("Загальне")).toBeInTheDocument();
    expect(screen.queryByText("Власне")).not.toBeInTheDocument();
  });

  it("shows a dash rating for an unrated publisher", () => {
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
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("labels an unknown country when the code is missing", () => {
    renderWithProviders(<PublisherRow publisher={makePublisherListItem({ countryCode: null })} />);

    expect(screen.getByText("Країна невідома")).toBeInTheDocument();
  });
});
