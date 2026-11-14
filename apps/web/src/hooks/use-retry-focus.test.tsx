import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { useRetryFocus } from "./use-retry-focus";

type LoadState = "data" | "error" | "pending";

function focusTarget() {
  return screen.getByRole("heading", { name: "Books" });
}

function retryArea(state: LoadState, onRetry: () => void = vi.fn()) {
  return <RetryProbe onRetry={onRetry} state={state} />;
}

function retryButton() {
  return screen.getByRole("button", { name: "Retry" });
}

function RetryProbe({ onRetry, state }: { onRetry: () => void; state: LoadState }) {
  const targetRef = useRef<HTMLHeadingElement>(null);
  const { retryButtonRef, withRetryFocus } = useRetryFocus(targetRef);

  return (
    <>
      <input aria-label="Search" />
      <h2 ref={targetRef} tabIndex={-1}>
        Books
      </h2>
      {state === "error" && (
        <button onClick={withRetryFocus(onRetry)} ref={retryButtonRef} type="button">
          Retry
        </button>
      )}
      {state === "data" && <p>Loaded books</p>}
    </>
  );
}

function searchField() {
  return screen.getByRole("textbox", { name: "Search" });
}

describe("useRetryFocus", () => {
  it("calls onRetry once and moves focus from the clicked Retry button to the target", async () => {
    const onRetry = vi.fn();
    renderWithProviders(retryArea("error", onRetry));

    await userEvent.click(retryButton());

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(focusTarget()).toHaveFocus();
  });

  it("focuses the new Retry button when the retry fails again", async () => {
    const { rerender } = renderWithProviders(retryArea("error"));

    await userEvent.click(retryButton());
    rerender(retryArea("pending"));
    rerender(retryArea("error"));

    expect(retryButton()).toHaveFocus();
  });

  it("leaves focus on the field the user moved to while the retry was pending", async () => {
    const { rerender } = renderWithProviders(retryArea("error"));

    await userEvent.click(retryButton());
    rerender(retryArea("pending"));
    await userEvent.click(searchField());
    rerender(retryArea("error"));

    expect(searchField()).toHaveFocus();
  });

  it("leaves focus on the page when the first load fails", () => {
    renderWithProviders(retryArea("error"));

    expect(document.body).toHaveFocus();
  });

  it("keeps focus on the target when the retried load succeeds", async () => {
    const { rerender } = renderWithProviders(retryArea("error"));

    await userEvent.click(retryButton());
    rerender(retryArea("pending"));
    rerender(retryArea("data"));

    expect(screen.getByText("Loaded books")).toBeInTheDocument();
    expect(focusTarget()).toHaveFocus();
  });
});
