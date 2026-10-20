import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { overviewFixture, statisticsIds } from "../../model/statistics.fixtures";
import { AuthorsSection } from "./authors-section";

const { authors } = overviewFixture();

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
});
