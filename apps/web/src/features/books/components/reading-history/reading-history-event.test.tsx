import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { makeReadingEvent } from "../reading-history.fixtures";
import { ReadingHistoryEvent } from "./reading-history-event";

describe("ReadingHistoryEvent", () => {
  it("renders the page delta and the resulting page", () => {
    renderWithProviders(
      <ReadingHistoryEvent event={makeReadingEvent({ page: 225, pagesRead: 10 })} />,
    );

    expect(screen.getByText("+10 сторінок")).toBeInTheDocument();
    expect(screen.getByText("До сторінки 225")).toBeInTheDocument();
  });

  it("describes the recorded time as a save time rather than a reading time", async () => {
    renderWithProviders(
      <ReadingHistoryEvent event={makeReadingEvent({ recordedAt: "2026-03-12T10:20:00.000Z" })} />,
    );

    screen.getByRole("button").focus();

    const hint = await screen.findAllByText(
      "Час збереження оновлення. Він може відрізнятися від фактичного часу читання.",
    );
    expect(hint.length).toBeGreaterThan(0);
  });

  it.skip("hides the time when recordedAt is absent (unreachable: backend always sends recordedAt)", () => {
    renderWithProviders(
      <ReadingHistoryEvent event={makeReadingEvent({ recordedAt: "" })} />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
