import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { stubTextMetrics } from "@/features/quotes/model/quotes.fixtures";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { completedReadFixture, statisticsIds } from "../model/statistics.fixtures";
import { CompletedReadCard } from "./completed-read-card";

const TITLE = "Гробниці Атуану";

const COVER_URL = "https://covers.test/atuan.jpg";

const CLAMPED_TWO_LINES = {
  clientHeight: 35,
  clientWidth: 120,
  scrollHeight: 70,
  scrollWidth: 120,
};

let restoreMetrics: () => void = () => undefined;

afterEach(() => {
  restoreMetrics();
  restoreMetrics = () => undefined;
  vi.unstubAllGlobals();
});

function readWithCover(coverThumbUrl: Nullable<string>) {
  return completedReadFixture({
    book: { bookId: statisticsIds.bookId, bookState: "active", coverThumbUrl, title: TITLE },
  });
}

describe("CompletedReadCard", () => {
  it("writes the title on the placeholder of a recent read without a cover", () => {
    renderWithProviders(<CompletedReadCard read={readWithCover(null)} variant="recent" />);

    expect(screen.getAllByText(TITLE)).toHaveLength(2);
  });

  it("shows the cover image instead of the titled placeholder when a recent read has one", () => {
    renderWithProviders(<CompletedReadCard read={readWithCover(COVER_URL)} variant="recent" />);

    expect(screen.getByRole("img", { name: TITLE })).toBeInTheDocument();
    expect(screen.getAllByText(TITLE)).toHaveLength(1);
  });

  it("keeps the title off the placeholder of a ranking read without a cover", () => {
    renderWithProviders(<CompletedReadCard read={readWithCover(null)} variant="ranking" />);

    expect(screen.getAllByText(TITLE)).toHaveLength(1);
  });

  it("reveals the full title on hover once the clamp hides a line of a recent read", async () => {
    restoreMetrics = stubTextMetrics(CLAMPED_TWO_LINES);
    const user = userEvent.setup();
    renderWithProviders(<CompletedReadCard read={readWithCover(COVER_URL)} variant="recent" />);

    await user.hover(screen.getByText(TITLE));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(TITLE);
  });

  it("offers no tooltip on a ranking title even when the clamp hides a line", () => {
    restoreMetrics = stubTextMetrics(CLAMPED_TWO_LINES);
    renderWithProviders(<CompletedReadCard read={readWithCover(COVER_URL)} variant="ranking" />);

    expect(screen.getByText(TITLE)).not.toHaveAttribute("data-slot", "tooltip-trigger");
  });

  it("still opens the read details when a clamped recent title is clicked", async () => {
    vi.stubGlobal("innerWidth", 1280);
    restoreMetrics = stubTextMetrics(CLAMPED_TWO_LINES);
    const user = userEvent.setup();
    renderWithProviders(<CompletedReadCard read={readWithCover(COVER_URL)} variant="recent" />);
    const title = screen.getByText(TITLE);

    await user.hover(title);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(TITLE);
    await user.click(title);

    expect(await screen.findByRole("dialog", { name: TITLE })).toBeInTheDocument();
  });

  it("shows both the finish day and the rating of a rated recent read", () => {
    renderWithProviders(<CompletedReadCard read={readWithCover(null)} variant="recent" />);

    expect(screen.getByText("14 бер.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "9/10" })).toBeInTheDocument();
  });
});
