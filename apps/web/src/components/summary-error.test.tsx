import type { Nullable } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { SummaryErrorState } from "./summary-error";

import { SummaryError } from "./summary-error";

const { summaryError } = messages.common;
const summaryText = messages.books.library.summary.total;
const skeletonText = messages.common.loading;

function failedState(): SummaryErrorState {
  return { onRetry: vi.fn() };
}

function retryButton() {
  return screen.getByRole("button", { name: summaryError.retry });
}

function summaryArea(state: Nullable<SummaryErrorState>, content = summaryText) {
  return (
    <SummaryError state={state}>
      <p>{content}</p>
    </SummaryError>
  );
}

function summaryAreaBesideSearch(state: Nullable<SummaryErrorState>, content = summaryText) {
  return (
    <>
      <input aria-label="Search" />
      {summaryArea(state, content)}
    </>
  );
}

describe("SummaryError", () => {
  it("shows the children without an error card while the summary is loaded", () => {
    renderWithProviders(summaryArea(null));

    expect(screen.getByText(summaryText)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: summaryError.retry })).not.toBeInTheDocument();
  });

  it("shows an error alert with a retry button in place of the children when the summary failed", () => {
    renderWithProviders(summaryArea(failedState()));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(summaryError.title);
    expect(alert).toHaveTextContent(summaryError.description);
    expect(within(alert).getByRole("button", { name: summaryError.retry })).toBeInTheDocument();
    expect(screen.queryByText(summaryText)).not.toBeInTheDocument();
  });

  it("calls onRetry once when Retry is clicked", async () => {
    const onRetry = vi.fn();
    renderWithProviders(summaryArea({ onRetry }));

    await userEvent.click(retryButton());

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("moves focus from the clicked Retry button to the summary region instead of the page body", async () => {
    renderWithProviders(summaryArea(failedState()));

    await userEvent.click(retryButton());

    expect(retryButton()).not.toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });

  it("keeps focus in the summary region when the retried summary loads", async () => {
    const { rerender } = renderWithProviders(summaryArea(failedState()));

    await userEvent.click(retryButton());
    rerender(summaryArea(null));

    expect(screen.getByText(summaryText)).toBeInTheDocument();
    expect(document.body).not.toHaveFocus();
  });

  it("focuses the new Retry button when the retry fails again", async () => {
    const state = failedState();
    const { rerender } = renderWithProviders(summaryArea(state));

    await userEvent.click(retryButton());
    rerender(summaryArea(null, skeletonText));
    rerender(summaryArea(state));

    expect(retryButton()).toHaveFocus();
  });

  it("leaves focus where the user moved it when a retry fails again", async () => {
    const state = failedState();
    const { rerender } = renderWithProviders(summaryAreaBesideSearch(state));

    await userEvent.click(retryButton());
    rerender(summaryAreaBesideSearch(null, skeletonText));
    await userEvent.click(screen.getByRole("textbox", { name: "Search" }));
    rerender(summaryAreaBesideSearch(state));

    expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();
  });

  it("leaves focus on the page when the summary fails on first load", () => {
    renderWithProviders(summaryArea(failedState()));

    expect(document.body).toHaveFocus();
  });
});
