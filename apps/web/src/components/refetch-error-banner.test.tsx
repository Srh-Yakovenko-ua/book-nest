import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { RefetchErrorBanner } from "./refetch-error-banner";

const common = messages.common;

describe("RefetchErrorBanner", () => {
  it("tells the user the refresh failed and offers a retry", () => {
    renderWithProviders(<RefetchErrorBanner state={{ isRetrying: false, onRetry: vi.fn() }} />);

    const banner = screen.getByRole("status");
    expect(within(banner).getByText(common.refetchError)).toBeInTheDocument();
    expect(within(banner).getByRole("button", { name: common.retry })).toBeEnabled();
  });

  it("calls onRetry once when the retry button is clicked", async () => {
    const onRetry = vi.fn();
    renderWithProviders(<RefetchErrorBanner state={{ isRetrying: false, onRetry }} />);

    await userEvent.click(screen.getByRole("button", { name: common.retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("marks the retry button busy and disabled while a retry is running", () => {
    renderWithProviders(<RefetchErrorBanner state={{ isRetrying: true, onRetry: vi.fn() }} />);

    const retry = screen.getByRole("button", { name: common.retry });
    expect(retry).toHaveAttribute("aria-busy", "true");
    expect(retry).toBeDisabled();
  });

  it("keeps an empty status region with no retry button when there is no error", () => {
    renderWithProviders(<RefetchErrorBanner state={null} />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("moves focus from the retry button to the status region on click", async () => {
    renderWithProviders(<RefetchErrorBanner state={{ isRetrying: false, onRetry: vi.fn() }} />);

    await userEvent.click(screen.getByRole("button", { name: common.retry }));

    expect(screen.getByRole("status")).toHaveFocus();
  });

  it("keeps focus on the status region after the error clears", async () => {
    const { rerender } = renderWithProviders(
      <RefetchErrorBanner state={{ isRetrying: false, onRetry: vi.fn() }} />,
    );

    await userEvent.click(screen.getByRole("button", { name: common.retry }));
    rerender(<RefetchErrorBanner state={null} />);

    expect(screen.getByRole("status")).toHaveFocus();
  });
});
