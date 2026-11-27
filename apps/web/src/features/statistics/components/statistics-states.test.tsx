import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import { StatisticsSectionState } from "./statistics-states";

const calendarCopy = messages.statistics.calendar;
const errorCopy = messages.statistics.states.error;

describe("StatisticsSectionState illustration", () => {
  it("shows the empty-calendar art with the calendar illustration", () => {
    renderWithProviders(
      <StatisticsSectionState illustration="calendar" kind="empty" title={calendarCopy.empty} />,
    );

    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining("line-calendar-empty.png"),
    );
    expect(screen.getByText(calendarCopy.empty)).toBeInTheDocument();
  });

  it("shows no art without an illustration", () => {
    renderWithProviders(<StatisticsSectionState kind="empty" title={calendarCopy.empty} />);

    expect(screen.getByText(calendarCopy.empty)).toBeInTheDocument();
    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
  });

  it("keeps an illustrated error announced as an alert", () => {
    renderWithProviders(
      <StatisticsSectionState illustration="calendar" kind="error" title={errorCopy.title} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(errorCopy.title);
  });
});
