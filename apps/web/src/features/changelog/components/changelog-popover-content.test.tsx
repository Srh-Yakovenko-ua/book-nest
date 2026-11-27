import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import { ChangelogPopoverContent } from "./changelog-popover-content";

const emptyCopy = messages.changelog.states.empty;

function showEmptyChangelog() {
  renderWithProviders(
    <ChangelogPopoverContent locale="uk" onRetry={vi.fn()} state={{ kind: "empty" }} />,
  );
}

describe("ChangelogPopoverContent empty state", () => {
  it("shows the sprouting book art", () => {
    showEmptyChangelog();

    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining("line-book-sprout.png"),
    );
  });

  it("tells the reader there are no updates yet", () => {
    showEmptyChangelog();

    expect(screen.getByText(emptyCopy.title)).toBeInTheDocument();
    expect(screen.getByText(emptyCopy.description)).toBeInTheDocument();
  });
});
