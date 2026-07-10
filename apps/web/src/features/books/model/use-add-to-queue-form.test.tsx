import type { ReactNode } from "react";

import { act, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";

import { useAddToQueueForm } from "./use-add-to-queue-form";

const positionErrors = messages.readingQueue.position.errors;
const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function chooseSpecific(result: { current: ReturnType<typeof useAddToQueueForm> }, value: string) {
  act(() => {
    result.current.setPlacement("specific");
    result.current.setPosition(value);
  });
}

function setup(queueLength: number) {
  return renderHook(() => useAddToQueueForm(queueLength), { wrapper });
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="uk" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("useAddToQueueForm", () => {
  it("defaults the placement to end", () => {
    const { result } = setup(3);

    expect(result.current.placement).toBe("end");
  });

  it("initialises the position to queueLength + 1", () => {
    const { result } = setup(3);

    expect(result.current.position).toBe("4");
  });

  it("initialises the position to 1 for an empty queue", () => {
    const { result } = setup(0);

    expect(result.current.position).toBe("1");
  });

  it("has no error for the default end placement", () => {
    const { result } = setup(3);

    expect(result.current.error).toBeUndefined();
  });

  it("requires a value when a specific position is empty", () => {
    const { result } = setup(3);

    chooseSpecific(result, "");

    expect(result.current.error).toBe(positionErrors.required);
  });

  it("rejects a non-numeric specific position", () => {
    const { result } = setup(3);

    chooseSpecific(result, "abc");

    expect(result.current.error).toBe(positionErrors.number);
  });

  it("rejects a fractional specific position", () => {
    const { result } = setup(3);

    chooseSpecific(result, "2.5");

    expect(result.current.error).toBe(positionErrors.integer);
  });

  it("rejects a non-positive specific position", () => {
    const { result } = setup(3);

    chooseSpecific(result, "0");

    expect(result.current.error).toBe(positionErrors.positive);
  });

  it("rejects a specific position beyond queueLength + 1", () => {
    const { result } = setup(3);

    chooseSpecific(result, "5");

    expect(result.current.error).toBe(positionErrors.max);
  });

  it("accepts queueLength + 1 as the last valid specific position", () => {
    const { result } = setup(3);

    chooseSpecific(result, "4");

    expect(result.current.error).toBeUndefined();
  });

  it("clears the error once a valid value replaces an invalid one", () => {
    const { result } = setup(3);

    chooseSpecific(result, "abc");
    act(() => {
      result.current.setPosition("2");
    });

    expect(result.current.error).toBeUndefined();
  });

  it("builds input without a position for the end placement", () => {
    const { result } = setup(3);

    expect(result.current.buildInput(BOOK_ID)).toEqual({ bookId: BOOK_ID, placement: "end" });
  });

  it("builds input without a position for the start placement", () => {
    const { result } = setup(3);

    act(() => {
      result.current.setPlacement("start");
    });

    expect(result.current.buildInput(BOOK_ID)).toEqual({ bookId: BOOK_ID, placement: "start" });
  });

  it("targets position 1 for a specific placement into an empty queue", () => {
    const { result } = setup(0);

    act(() => {
      result.current.setPlacement("specific");
    });

    expect(result.current.buildInput(BOOK_ID)).toEqual({
      bookId: BOOK_ID,
      placement: "specific",
      position: 1,
    });
  });

  it("returns null when the specific position is invalid", () => {
    const { result } = setup(3);

    chooseSpecific(result, "abc");

    expect(result.current.buildInput(BOOK_ID)).toBeNull();
  });

  it("builds a specific input from a valid position", () => {
    const { result } = setup(3);

    chooseSpecific(result, "2");

    expect(result.current.buildInput(BOOK_ID)).toEqual({
      bookId: BOOK_ID,
      placement: "specific",
      position: 2,
    });
  });

  it("restores the defaults after reset", () => {
    const { result } = setup(3);

    chooseSpecific(result, "2");
    act(() => {
      result.current.reset();
    });

    expect(result.current.placement).toBe("end");
    expect(result.current.position).toBe("4");
  });
});
