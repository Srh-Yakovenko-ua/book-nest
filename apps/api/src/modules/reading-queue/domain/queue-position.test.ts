import { describe, expect, it } from "vitest";

import { computeQueueInsertPosition, QUEUE_POSITION_TOO_LARGE_MESSAGE } from "./queue-position.js";

describe("computeQueueInsertPosition", () => {
  describe("placement end", () => {
    it("returns position 1 for an empty queue", () => {
      expect(computeQueueInsertPosition({ count: 0, placement: "end" })).toEqual({
        ok: true,
        position: 1,
      });
    });

    it("returns count + 1 for a populated queue", () => {
      expect(computeQueueInsertPosition({ count: 3, placement: "end" })).toEqual({
        ok: true,
        position: 4,
      });
    });
  });

  describe("placement start", () => {
    it("returns position 1 for an empty queue", () => {
      expect(computeQueueInsertPosition({ count: 0, placement: "start" })).toEqual({
        ok: true,
        position: 1,
      });
    });

    it("returns position 1 regardless of the queue length", () => {
      expect(computeQueueInsertPosition({ count: 3, placement: "start" })).toEqual({
        ok: true,
        position: 1,
      });
    });
  });

  describe("placement specific", () => {
    it("accepts a position within the queue length", () => {
      expect(computeQueueInsertPosition({ count: 3, placement: "specific", position: 2 })).toEqual({
        ok: true,
        position: 2,
      });
    });

    it("accepts the append boundary position of count + 1", () => {
      expect(computeQueueInsertPosition({ count: 3, placement: "specific", position: 4 })).toEqual({
        ok: true,
        position: 4,
      });
    });

    it("rejects a position above count + 1", () => {
      expect(computeQueueInsertPosition({ count: 3, placement: "specific", position: 5 })).toEqual({
        message: QUEUE_POSITION_TOO_LARGE_MESSAGE,
        ok: false,
      });
    });

    it("accepts position 1 for an empty queue", () => {
      expect(computeQueueInsertPosition({ count: 0, placement: "specific", position: 1 })).toEqual({
        ok: true,
        position: 1,
      });
    });

    it("rejects position 2 for an empty queue", () => {
      expect(computeQueueInsertPosition({ count: 0, placement: "specific", position: 2 })).toEqual({
        message: QUEUE_POSITION_TOO_LARGE_MESSAGE,
        ok: false,
      });
    });
  });
});
