import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { ReadingDaySummaryRow } from "./reading-day-summary-row";

describe("ReadingDaySummaryRow", () => {
  it("renders the date, page delta, update count and final page", () => {
    renderWithProviders(
      <ReadingDaySummaryRow date="2026-03-12" finalPage={250} pagesRead={35} updatesCount={3} />,
    );

    expect(screen.getByText(/12 бер\. 2026/)).toBeInTheDocument();
    expect(screen.getByText("+35 сторінок")).toBeInTheDocument();
    expect(screen.getByText("3 оновлення")).toBeInTheDocument();
    expect(screen.getByText("До сторінки 250")).toBeInTheDocument();
  });

  it("omits the final page when the backend does not provide one", () => {
    renderWithProviders(
      <ReadingDaySummaryRow date="2026-03-12" finalPage={null} pagesRead={35} updatesCount={3} />,
    );

    expect(screen.queryByText(/До сторінки/)).not.toBeInTheDocument();
  });

  it("renders the singular Ukrainian plural form for a single update", () => {
    renderWithProviders(
      <ReadingDaySummaryRow date="2026-03-12" finalPage={200} pagesRead={1} updatesCount={1} />,
    );

    expect(screen.getByText("+1 сторінка")).toBeInTheDocument();
    expect(screen.getByText("1 оновлення")).toBeInTheDocument();
  });
});
