import type { ReactNode } from "react";

import { act, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";

import type { QueuePickerItem } from "./queue-placement";

import { useAddToQueueForm } from "./use-add-to-queue-form";

const positionErrors = messages.readingQueue.position.errors;
const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function chooseSpecific(result: { current: ReturnType<typeof useAddToQueueForm> }, value: string) {
  act(() => {
    result.current.setPlacement("specific");
    result.current.setPosition(value);
  });
}

function makeItems(count: number): QueuePickerItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `book-${index}`,
    position: index + 1,
    title: `Book ${index + 1}`,
  }));
}

function setupAdd(queueLength: number) {
  return renderHook(() => useAddToQueueForm({ queueItems: makeItems(queueLength) }), { wrapper });
}

function setupMove(queueLength: number, currentBookId: string) {
  return renderHook(
    () => useAddToQueueForm({ currentBookId, queueItems: makeItems(queueLength) }),
    { wrapper },
  );
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
    const { result } = setupAdd(3);

    expect(result.current.placement).toBe("end");
    expect(result.current.mode).toBe("add");
  });

  it("starts with an empty position field", () => {
    const { result } = setupAdd(3);

    expect(result.current.position).toBe("");
  });

  it("exposes a max position of queueLength + 1 when adding", () => {
    const { result } = setupAdd(3);

    expect(result.current.maxPosition).toBe(4);
  });

  it("has no error and a valid end outcome by default", () => {
    const { result } = setupAdd(3);

    expect(result.current.error).toBeUndefined();
    expect(result.current.isValid).toBe(true);
    expect(result.current.outcome).toEqual({ kind: "end", position: 4 });
  });

  it("requires a value when a specific position is empty", () => {
    const { result } = setupAdd(3);

    chooseSpecific(result, "");

    expect(result.current.error).toBe(positionErrors.required);
    expect(result.current.isValid).toBe(false);
  });

  it("rejects a non-numeric specific position", () => {
    const { result } = setupAdd(3);

    chooseSpecific(result, "abc");

    expect(result.current.error).toBe(positionErrors.number);
  });

  it("rejects a fractional specific position", () => {
    const { result } = setupAdd(3);

    chooseSpecific(result, "2.5");

    expect(result.current.error).toBe(positionErrors.integer);
  });

  it("rejects a non-positive specific position", () => {
    const { result } = setupAdd(3);

    chooseSpecific(result, "0");

    expect(result.current.error).toBe(positionErrors.positive);
  });

  it("rejects a specific position beyond queueLength + 1 when adding", () => {
    const { result } = setupAdd(3);

    chooseSpecific(result, "5");

    expect(result.current.error).toBe(positionErrors.max);
  });

  it("accepts queueLength + 1 as the last valid specific position when adding", () => {
    const { result } = setupAdd(3);

    chooseSpecific(result, "4");

    expect(result.current.error).toBeUndefined();
    expect(result.current.outcome).toEqual({ kind: "specific", position: 4 });
  });

  it("clears the error once a valid value replaces an invalid one", () => {
    const { result } = setupAdd(3);

    chooseSpecific(result, "abc");
    act(() => {
      result.current.setPosition("2");
    });

    expect(result.current.error).toBeUndefined();
  });

  it("builds input without a position for the end placement", () => {
    const { result } = setupAdd(3);

    expect(result.current.buildInput(BOOK_ID)).toEqual({ bookId: BOOK_ID, placement: "end" });
  });

  it("builds input without a position for the start placement", () => {
    const { result } = setupAdd(3);

    act(() => {
      result.current.setPlacement("start");
    });

    expect(result.current.buildInput(BOOK_ID)).toEqual({ bookId: BOOK_ID, placement: "start" });
  });

  it("targets position 1 for any placement into an empty queue", () => {
    const { result } = setupAdd(0);

    expect(result.current.queueLength).toBe(0);
    expect(result.current.outcome).toEqual({ kind: "first" });
    expect(result.current.buildInput(BOOK_ID)).toEqual({
      bookId: BOOK_ID,
      placement: "specific",
      position: 1,
    });
  });

  it("returns null when the specific position is invalid", () => {
    const { result } = setupAdd(3);

    chooseSpecific(result, "abc");

    expect(result.current.buildInput(BOOK_ID)).toBeNull();
  });

  it("builds a specific input from a valid position", () => {
    const { result } = setupAdd(3);

    chooseSpecific(result, "2");

    expect(result.current.buildInput(BOOK_ID)).toEqual({
      bookId: BOOK_ID,
      placement: "specific",
      position: 2,
    });
  });

  it("maps an 'after' relative choice to the next position when adding", () => {
    const { result } = setupAdd(3);

    act(() => {
      result.current.setPlacement("relative");
      result.current.setRelativeBookId("book-1");
      result.current.setRelativeSide("after");
    });

    expect(result.current.outcome).toEqual({
      kind: "relative",
      position: 3,
      side: "after",
      title: "Book 2",
    });
    expect(result.current.buildInput(BOOK_ID)).toEqual({
      bookId: BOOK_ID,
      placement: "specific",
      position: 3,
    });
  });

  it("is invalid while a relative choice has no target selected", () => {
    const { result } = setupAdd(3);

    act(() => {
      result.current.setPlacement("relative");
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.buildInput(BOOK_ID)).toBeNull();
  });

  it("restores the defaults after reset", () => {
    const { result } = setupAdd(3);

    chooseSpecific(result, "2");
    act(() => {
      result.current.reset();
    });

    expect(result.current.placement).toBe("end");
    expect(result.current.position).toBe("");
    expect(result.current.relativeBookId).toBeNull();
  });
});

describe("useAddToQueueForm (move mode)", () => {
  it("switches to move mode and excludes the current book from the candidates", () => {
    const { result } = setupMove(3, "book-0");

    expect(result.current.mode).toBe("move");
    expect(result.current.maxPosition).toBe(3);
    expect(result.current.relativeCandidates.map((item) => item.id)).toEqual(["book-1", "book-2"]);
  });

  it("builds a reorder array that moves the book to the end", () => {
    const { result } = setupMove(3, "book-0");

    act(() => {
      result.current.setPlacement("end");
    });

    expect(result.current.buildOrder()).toEqual(["book-1", "book-2", "book-0"]);
  });

  it("builds a reorder array from a relative 'before' choice", () => {
    const { result } = setupMove(3, "book-0");

    act(() => {
      result.current.setPlacement("relative");
      result.current.setRelativeBookId("book-2");
      result.current.setRelativeSide("before");
    });

    expect(result.current.outcome).toEqual({
      kind: "relative",
      position: 2,
      side: "before",
      title: "Book 3",
    });
    expect(result.current.buildOrder()).toEqual(["book-1", "book-0", "book-2"]);
  });

  it("rejects a specific position beyond the queue length when moving", () => {
    const { result } = setupMove(3, "book-0");

    chooseSpecific(result, "4");

    expect(result.current.error).toBe(positionErrors.max);
  });
});
