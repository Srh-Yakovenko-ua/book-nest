import type { ReactNode } from "react";

import { renderHook, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import { useHistoryParams } from "./use-history-params";

let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => currentSearchParams,
}));

function renderParams(searchParams = "") {
  currentSearchParams = new URLSearchParams(searchParams);

  const onUrlUpdate = vi.fn();

  const view = renderHook(() => useHistoryParams(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={searchParams}>
        {children}
      </NuqsTestingAdapter>
    ),
  });

  return { ...view, onUrlUpdate };
}

describe("useHistoryParams", () => {
  it("keeps reading the filters that survived a retired tracking parameter", async () => {
    const { result } = renderParams("?tab=received&hasTrackingNumber=true&store=Yakaboo");

    await waitFor(() => expect(result.current.advanced.store).toEqual(["Yakaboo"]));
    expect(result.current.advancedCount).toBe(1);
  });

  it("drops the receipt range when the reader opens the cancelled tab", async () => {
    const { result } = renderParams("?tab=received&receivedFrom=2026-08-01");

    result.current.setTab("cancelled");

    await waitFor(() => expect(result.current.tab).toBe("cancelled"));
    expect(result.current.advanced.receivedFrom).toBeNull();
  });

  it("drops the cancellation range when the reader goes back to the received tab", async () => {
    const { result } = renderParams("?tab=cancelled&cancelledFrom=2026-08-01");

    result.current.setTab("received");

    await waitFor(() => expect(result.current.tab).toBe("received"));
    expect(result.current.advanced.cancelledFrom).toBeNull();
  });

  it("keeps the search, the sort and the tab when the advanced filters are cleared", async () => {
    const { result } = renderParams("?tab=cancelled&q=dune&sort=oldest_orders&store=Yakaboo");

    result.current.clearAdvanced();

    await waitFor(() => expect(result.current.advanced.store).toEqual([]));
    expect(result.current.state.q).toBe("dune");
    expect(result.current.sort).toBe("oldest_orders");
    expect(result.current.tab).toBe("cancelled");
  });

  it("counts the dimensions of the open tab only", async () => {
    const { result } = renderParams("?tab=received&receivedFrom=2026-08-01&cancelledTo=2026-08-05");

    await waitFor(() => expect(result.current.advancedCount).toBe(1));
  });

  it("falls back to the default sort while several currencies are picked", async () => {
    const { result } = renderParams("?currency=UAH,EUR&sort=price_asc");

    await waitFor(() => expect(result.current.sort).toBe("newest_orders"));
    expect(result.current.canSortByPrice).toBe(false);
  });
});
