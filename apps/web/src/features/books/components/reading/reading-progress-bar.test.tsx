import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { ReadingProgressBar } from "./reading-progress-bar";

describe("ReadingProgressBar", () => {
  it("shows a page-only label without a progress bar when the page count is unknown", () => {
    renderWithProviders(<ReadingProgressBar currentPage={250} pagesCount={null} percent={null} />);

    expect(screen.getByText("Сторінка 250")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows the page ratio without a bar when the percent is unknown", () => {
    renderWithProviders(<ReadingProgressBar currentPage={250} pagesCount={320} percent={null} />);

    expect(screen.getByText("250 із 320 сторінок")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("exposes the percent through the progressbar role", () => {
    renderWithProviders(<ReadingProgressBar currentPage={250} pagesCount={320} percent={78} />);

    const bar = screen.getByRole("progressbar", { name: "Прогрес читання" });
    expect(bar).toHaveAttribute("aria-valuenow", "78");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("78%")).toBeInTheDocument();
  });
});
