import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useStoreHighlight } from "./use-store-highlight";

function pressEscape() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
}

function pressEscapeSwallowedByAnotherLayer() {
  const swallow = (event: Event) => event.preventDefault();

  window.addEventListener("keydown", swallow, true);
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" }),
  );
  window.removeEventListener("keydown", swallow, true);
}

describe("useStoreHighlight", () => {
  it("starts with nothing hovered and nothing selected", () => {
    const { result } = renderHook(() => useStoreHighlight());

    expect(result.current.activeStoreKey).toBe(null);
    expect(result.current.selectedStoreKey).toBe(null);
  });

  it("makes a hovered store active without selecting it", () => {
    const { result } = renderHook(() => useStoreHighlight());

    act(() => result.current.hover("yakaboo"));

    expect(result.current.activeStoreKey).toBe("yakaboo");
    expect(result.current.selectedStoreKey).toBe(null);
  });

  it("forgets a hovered store the moment the pointer leaves", () => {
    const { result } = renderHook(() => useStoreHighlight());

    act(() => result.current.hover("yakaboo"));
    act(() => result.current.hover(null));

    expect(result.current.activeStoreKey).toBe(null);
  });

  it("keeps a selected store active after the pointer leaves", () => {
    const { result } = renderHook(() => useStoreHighlight());

    act(() => result.current.select("yakaboo"));
    act(() => result.current.hover(null));

    expect(result.current.activeStoreKey).toBe("yakaboo");
    expect(result.current.selectedStoreKey).toBe("yakaboo");
  });

  it("lets a hover win the highlight while leaving the selection alone", () => {
    const { result } = renderHook(() => useStoreHighlight());

    act(() => result.current.select("yakaboo"));
    act(() => result.current.hover("vivat"));

    expect(result.current.activeStoreKey).toBe("vivat");
    expect(result.current.selectedStoreKey).toBe("yakaboo");
  });

  it("falls back to the selected store when the hover ends", () => {
    const { result } = renderHook(() => useStoreHighlight());

    act(() => result.current.select("yakaboo"));
    act(() => result.current.hover("vivat"));
    act(() => result.current.hover(null));

    expect(result.current.activeStoreKey).toBe("yakaboo");
  });

  it("moves the selection to the store selected next", () => {
    const { result } = renderHook(() => useStoreHighlight());

    act(() => result.current.select("yakaboo"));
    act(() => result.current.select("vivat"));

    expect(result.current.selectedStoreKey).toBe("vivat");
  });

  it("releases the store selected a second time", () => {
    const { result } = renderHook(() => useStoreHighlight());

    act(() => result.current.select("yakaboo"));
    act(() => result.current.select("yakaboo"));

    expect(result.current.selectedStoreKey).toBe(null);
  });

  it("drops the selection on Escape", () => {
    const { result } = renderHook(() => useStoreHighlight());

    act(() => result.current.select("yakaboo"));
    act(pressEscape);

    expect(result.current.selectedStoreKey).toBe(null);
    expect(result.current.activeStoreKey).toBe(null);
  });

  it("keeps the selection when a layer above already answered the Escape", () => {
    const { result } = renderHook(() => useStoreHighlight());

    act(() => result.current.select("yakaboo"));
    act(pressEscapeSwallowedByAnotherLayer);

    expect(result.current.selectedStoreKey).toBe("yakaboo");

    act(pressEscape);

    expect(result.current.selectedStoreKey).toBe(null);
  });

  it("stops listening for Escape once nothing is selected", () => {
    const addListener = vi.spyOn(window, "addEventListener");
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { result } = renderHook(() => useStoreHighlight());

    act(() => result.current.select("yakaboo"));
    const added = addListener.mock.calls.find(([type]) => type === "keydown");
    act(pressEscape);

    expect(added).toBeDefined();
    expect(removeListener).toHaveBeenCalledWith("keydown", added?.[1]);
  });

  it("stops listening for Escape once it unmounts", () => {
    const addListener = vi.spyOn(window, "addEventListener");
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { result, unmount } = renderHook(() => useStoreHighlight());

    act(() => result.current.select("yakaboo"));
    const added = addListener.mock.calls.find(([type]) => type === "keydown");
    unmount();

    expect(added).toBeDefined();
    expect(removeListener).toHaveBeenCalledWith("keydown", added?.[1]);
  });
});
