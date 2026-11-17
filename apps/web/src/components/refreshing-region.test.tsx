import { describe, expect, it } from "vitest";

import { renderWithProviders, screen, within } from "@/test-utils";

import { RefreshingRegion } from "./refreshing-region";

const REGION_LABEL = "Results";

function mountRegion({ className, isRefreshing }: { className?: string; isRefreshing: boolean }) {
  renderWithProviders(
    <RefreshingRegion
      aria-label={REGION_LABEL}
      className={className}
      isRefreshing={isRefreshing}
      role="region"
    >
      <p>Stale rows</p>
    </RefreshingRegion>,
  );
  return screen.getByRole("region", { name: REGION_LABEL });
}

describe("RefreshingRegion", () => {
  it("marks the region busy and dims it while refreshing", () => {
    const region = mountRegion({ isRefreshing: true });

    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveClass("opacity-60");
  });

  it("makes the stale content inert while refreshing", () => {
    const region = mountRegion({ isRefreshing: true });

    expect(region).toHaveAttribute("inert");
  });

  it("marks the region idle and leaves it undimmed when not refreshing", () => {
    const region = mountRegion({ isRefreshing: false });

    expect(region).toHaveAttribute("aria-busy", "false");
    expect(region).not.toHaveClass("opacity-60");
  });

  it("leaves the content interactive when not refreshing", () => {
    const region = mountRegion({ isRefreshing: false });

    expect(region).not.toHaveAttribute("inert");
  });

  it.each([true, false])(
    "keeps the fade transition with a reduced-motion opt-out when isRefreshing is %s",
    (isRefreshing) => {
      const region = mountRegion({ isRefreshing });

      expect(region).toHaveClass(
        "transition-opacity",
        "duration-200",
        "motion-reduce:transition-none",
      );
    },
  );

  it("merges the caller className with its own classes", () => {
    const region = mountRegion({ className: "mt-4", isRefreshing: true });

    expect(region).toHaveClass("mt-4", "transition-opacity", "opacity-60");
  });

  it("passes extra div props through", () => {
    renderWithProviders(
      <RefreshingRegion
        aria-label={REGION_LABEL}
        data-section="wishlist"
        id="wishlist-results"
        isRefreshing={false}
        role="region"
      >
        <p>Stale rows</p>
      </RefreshingRegion>,
    );

    const region = screen.getByRole("region", { name: REGION_LABEL });
    expect(region).toHaveAttribute("data-section", "wishlist");
    expect(region).toHaveAttribute("id", "wishlist-results");
  });

  it("renders its children inside the region", () => {
    const region = mountRegion({ isRefreshing: false });

    expect(within(region).getByText("Stale rows")).toBeInTheDocument();
  });
});
