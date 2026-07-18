import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { makeReadingActivity } from "../reading-history.fixtures";
import { ReadingActivityChart } from "./reading-activity-chart";

describe("ReadingActivityChart", () => {
  it("renders the backend activity summary as text so the chart is not the only source", () => {
    renderWithProviders(
      <ReadingActivityChart
        activity={makeReadingActivity({
          summary: {
            activeDaysCount: 3,
            averagePagesPerActiveDay: 55.7,
            bestDay: null,
            pagesRead: 167,
            updatesCount: 5,
          },
        })}
      />,
    );

    expect(
      screen.getByText("3 активні дні · 167 сторінок · 55,7 стор./активний день"),
    ).toBeInTheDocument();
  });

  it("omits the average from the summary when the backend returns null", () => {
    renderWithProviders(
      <ReadingActivityChart
        activity={makeReadingActivity({
          summary: {
            activeDaysCount: 3,
            averagePagesPerActiveDay: null,
            bestDay: null,
            pagesRead: 167,
            updatesCount: 5,
          },
        })}
      />,
    );

    expect(screen.getByText("3 активні дні · 167 сторінок")).toBeInTheDocument();
  });
});
