import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import enMessages from "@/messages/en.json";
import ukMessages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import { ReadingHistoryEmptyState } from "./reading-history-empty-state";

const ukHistory = ukMessages.books.details.readingHistory;
const enHistory = enMessages.books.details.readingHistory;

describe("ReadingHistoryEmptyState illustration", () => {
  it("shows the Ukrainian-lettered art in the uk locale", () => {
    renderWithProviders(<ReadingHistoryEmptyState />);

    expect(screen.getByText(ukHistory.emptyTitle)).toBeInTheDocument();
    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining("empty-reading-history-uk.png"),
    );
  });

  it("shows the English-lettered art in the en locale", () => {
    renderWithProviders(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ReadingHistoryEmptyState />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(enHistory.emptyTitle)).toBeInTheDocument();
    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining("empty-reading-history-en.png"),
    );
  });
});
