import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { PublishersMissingBanner } from "./publishers-missing-banner";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe("PublishersMissingBanner", () => {
  it("stays hidden when every book has a publisher", () => {
    renderWithProviders(<PublishersMissingBanner count={0} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("counts the books without a publisher when there are some", () => {
    renderWithProviders(<PublishersMissingBanner count={3} />);

    expect(screen.getByText("3 книги без видавництва")).toBeInTheDocument();
  });

  it("links to the books missing a publisher", () => {
    renderWithProviders(<PublishersMissingBanner count={3} />);

    expect(screen.getByRole("link", { name: "Переглянути книги" })).toHaveAttribute(
      "href",
      "/books?publisherPresence=missing",
    );
  });
});
