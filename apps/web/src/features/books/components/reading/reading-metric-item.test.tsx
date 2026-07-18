import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { ReadingMetricItem } from "./reading-metric-item";

describe("ReadingMetricItem", () => {
  it("renders the value with a secondary hint", () => {
    renderWithProviders(
      <ReadingMetricItem hint="10 бер. 2026" value="84 стор. — найкращий день" />,
    );

    expect(screen.getByText("84 стор. — найкращий день")).toBeInTheDocument();
    expect(screen.getByText("10 бер. 2026")).toBeInTheDocument();
  });

  it("renders only the value when no hint is provided", () => {
    renderWithProviders(<ReadingMetricItem value="6 активних днів" />);

    expect(screen.getByText("6 активних днів")).toBeInTheDocument();
  });
});
