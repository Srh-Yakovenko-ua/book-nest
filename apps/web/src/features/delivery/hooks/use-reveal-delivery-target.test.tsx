import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRevealDeliveryTarget } from "./use-reveal-delivery-target";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

type ListState = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isShowingPreviousList: boolean;
  loadedOrderIds: readonly string[];
  loadedShipmentIds: readonly string[];
};

const STALE_LIST: ListState = {
  hasNextPage: false,
  isFetchingNextPage: false,
  isShowingPreviousList: true,
  loadedOrderIds: [],
  loadedShipmentIds: [],
};

const SETTLED_LIST: ListState = {
  ...STALE_LIST,
  isShowingPreviousList: false,
  loadedOrderIds: [ORDER_ID],
};

function mountOrderCard(orderId: string): HTMLElement {
  const card = document.createElement("article");
  card.setAttribute("data-order-id", orderId);
  card.scrollIntoView = vi.fn();
  document.body.append(card);
  return card;
}

function setup(initialProps: ListState) {
  const fetchNextPage = vi.fn();
  const view = renderHook(
    (props: ListState) => useRevealDeliveryTarget({ ...props, fetchNextPage }),
    { initialProps },
  );
  return { fetchNextPage, view };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useRevealDeliveryTarget", () => {
  it("waits for the filtered list instead of dropping a reveal requested alongside it", () => {
    const card = mountOrderCard(ORDER_ID);
    const { view } = setup(STALE_LIST);

    act(() => view.result.current.request({ id: ORDER_ID, kind: "order" }));
    expect(view.result.current.revealed).toBeNull();

    view.rerender(SETTLED_LIST);

    expect(view.result.current.revealed).toEqual({ id: ORDER_ID, kind: "order" });
    expect(card.scrollIntoView).toHaveBeenCalled();
  });

  it("gives up once the settled list turns out not to hold the target", () => {
    const { view } = setup({ ...STALE_LIST, isShowingPreviousList: false });

    act(() => view.result.current.request({ id: ORDER_ID, kind: "order" }));

    expect(view.result.current.revealed).toBeNull();

    view.rerender({ ...STALE_LIST, isShowingPreviousList: false, loadedOrderIds: [ORDER_ID] });

    expect(view.result.current.revealed).toBeNull();
  });

  it("asks for the next page while one is still left to search", () => {
    const { fetchNextPage, view } = setup({
      ...STALE_LIST,
      hasNextPage: true,
      isShowingPreviousList: false,
    });

    act(() => view.result.current.request({ id: ORDER_ID, kind: "order" }));

    expect(fetchNextPage).toHaveBeenCalled();
    expect(view.result.current.revealed).toBeNull();
  });
});
