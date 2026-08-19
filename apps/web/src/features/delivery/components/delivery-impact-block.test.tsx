import "@testing-library/jest-dom/vitest";

import type { InTransitImpact } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { DeliveryImpactBlock } from "./delivery-impact-block";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const ALL_FIVE: InTransitImpact[] = [
  { booksCount: 3, kind: "series_completed", seriesCount: 2 },
  { booksCount: 4, kind: "series_ownership_gaps", seriesCount: 3 },
  { booksCount: 3, highPriorityCount: 1, kind: "queue_available" },
  { kind: "series_next_step", seriesCount: 2 },
  { booksCount: 2, goalsCount: 1, kind: "goal_books" },
];

function rowTexts(): string[] {
  return screen.getAllByRole("listitem").map((row) => row.textContent ?? "");
}

describe("DeliveryImpactBlock", () => {
  it("renders nothing when receiving would change nothing meaningful", () => {
    const { container } = renderWithProviders(<DeliveryImpactBlock impact={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the three most valuable insights and hides the rest behind a toggle", () => {
    renderWithProviders(<DeliveryImpactBlock impact={ALL_FIVE} />);

    expect(rowTexts()).toHaveLength(3);
    expect(rowTexts()[0]).toContain("2");
    expect(screen.getByRole("button")).toHaveTextContent("2");
  });

  it("reveals the remaining insights once the reader asks for them", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeliveryImpactBlock impact={ALL_FIVE} />);

    await user.click(screen.getByRole("button"));

    expect(rowTexts()).toHaveLength(5);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the toggle away when everything already fits", () => {
    renderWithProviders(<DeliveryImpactBlock impact={ALL_FIVE.slice(0, 3)} />);

    expect(rowTexts()).toHaveLength(3);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("links the queue insight to its page and leaves the rows without a page informational", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeliveryImpactBlock impact={ALL_FIVE} />);
    await user.click(screen.getByRole("button"));

    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));

    expect(hrefs).toEqual(["/reading-queue"]);
  });

  it("omits the priority helper when no arriving queue book is high priority", () => {
    renderWithProviders(
      <DeliveryImpactBlock
        impact={[{ booksCount: 3, highPriorityCount: 0, kind: "queue_available" }]}
      />,
    );

    expect(rowTexts()).toHaveLength(1);
    expect(rowTexts()[0]).not.toContain("пріоритет");
  });
});
