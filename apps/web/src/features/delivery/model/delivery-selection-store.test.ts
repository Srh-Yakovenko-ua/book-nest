import { beforeEach, describe, expect, it } from "vitest";

import { useDeliverySelectionStore } from "./delivery-selection-store";

function selectedIds(): string[] {
  return Array.from(useDeliverySelectionStore.getState().selectedIds);
}

beforeEach(() => {
  useDeliverySelectionStore.getState().exitSelection();
});

describe("useDeliverySelectionStore", () => {
  it("starts outside selection mode with nothing selected", () => {
    expect(useDeliverySelectionStore.getState().selectionMode).toBe(false);
    expect(selectedIds()).toEqual([]);
  });

  it("adds and removes a parcel on each toggle", () => {
    const { toggle } = useDeliverySelectionStore.getState();

    toggle("shipment-1");
    toggle("shipment-2");
    expect(selectedIds()).toEqual(["shipment-1", "shipment-2"]);

    toggle("shipment-1");
    expect(selectedIds()).toEqual(["shipment-2"]);
  });

  it("replaces the selection when every visible parcel is picked at once", () => {
    const { selectAll, toggle } = useDeliverySelectionStore.getState();

    toggle("shipment-1");
    selectAll(["shipment-2", "shipment-3"]);

    expect(selectedIds()).toEqual(["shipment-2", "shipment-3"]);
  });

  it("drops the parcels a new filter took off the page", () => {
    const { selectAll, setAvailable } = useDeliverySelectionStore.getState();

    selectAll(["shipment-1", "shipment-2", "shipment-3"]);
    setAvailable(["shipment-2"]);

    expect(selectedIds()).toEqual(["shipment-2"]);
  });

  it("keeps the same selection object when every selected parcel is still on the page", () => {
    const { selectAll, setAvailable } = useDeliverySelectionStore.getState();

    selectAll(["shipment-1", "shipment-2"]);
    const before = useDeliverySelectionStore.getState().selectedIds;
    setAvailable(["shipment-1", "shipment-2", "shipment-3"]);

    expect(useDeliverySelectionStore.getState().selectedIds).toBe(before);
  });

  it("leaves selection mode on when the selection is only cleared", () => {
    const { clear, enterSelection, toggle } = useDeliverySelectionStore.getState();

    enterSelection();
    toggle("shipment-1");
    clear();

    expect(selectedIds()).toEqual([]);
    expect(useDeliverySelectionStore.getState().selectionMode).toBe(true);
  });

  it("forgets both the mode and the selection on the way out", () => {
    const { enterSelection, exitSelection, toggle } = useDeliverySelectionStore.getState();

    enterSelection();
    toggle("shipment-1");
    exitSelection();

    expect(selectedIds()).toEqual([]);
    expect(useDeliverySelectionStore.getState().selectionMode).toBe(false);
  });
});
