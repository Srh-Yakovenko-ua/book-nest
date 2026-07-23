import { describe, expect, it } from "vitest";

import { toQueueEstimate, toQueueVolumeForecast } from "./queue-volume-format";

describe("toQueueEstimate", () => {
  it("uses days below the two-week boundary", () => {
    expect(toQueueEstimate({ daysMax: 13, daysMin: 9 })).toEqual({
      kind: "range",
      max: 13,
      min: 9,
      unit: "days",
    });
  });

  it("switches to weeks at the two-week boundary", () => {
    expect(toQueueEstimate({ daysMax: 14, daysMin: 14 })).toEqual({
      kind: "single",
      unit: "weeks",
      value: 2,
    });
  });

  it("uses weeks below the sixty-day boundary", () => {
    expect(toQueueEstimate({ daysMax: 59, daysMin: 45 })).toEqual({
      kind: "range",
      max: 8,
      min: 6,
      unit: "weeks",
    });
  });

  it("switches to months at the sixty-day boundary", () => {
    expect(toQueueEstimate({ daysMax: 60, daysMin: 60 })).toEqual({
      kind: "single",
      unit: "months",
      value: 2,
    });
  });

  it("uses months below the one-year boundary", () => {
    expect(toQueueEstimate({ daysMax: 364, daysMin: 300 })).toEqual({
      kind: "range",
      max: 12,
      min: 10,
      unit: "months",
    });
  });

  it("reports over a year at the one-year boundary", () => {
    expect(toQueueEstimate({ daysMax: 365, daysMin: 300 })).toEqual({ kind: "overYear" });
  });

  it("collapses bounds that round to the same value", () => {
    expect(toQueueEstimate({ daysMax: 22, daysMin: 20 })).toEqual({
      kind: "single",
      unit: "weeks",
      value: 3,
    });
  });

  it("collapses identical inputs", () => {
    expect(toQueueEstimate({ daysMax: 5, daysMin: 5 })).toEqual({
      kind: "single",
      unit: "days",
      value: 5,
    });
  });

  it("keeps the lower bound at one for a single-day estimate", () => {
    expect(toQueueEstimate({ daysMax: 3, daysMin: 1 })).toEqual({
      kind: "range",
      max: 3,
      min: 1,
      unit: "days",
    });
  });

  it("never rounds a sub-unit lower bound down to zero", () => {
    expect(toQueueEstimate({ daysMax: 30, daysMin: 2 })).toEqual({
      kind: "range",
      max: 4,
      min: 1,
      unit: "weeks",
    });
  });
});

describe("toQueueVolumeForecast", () => {
  it("returns the estimate when the forecast is available", () => {
    expect(
      toQueueVolumeForecast({
        daysMax: 20,
        daysMin: 15,
        daysUntilForecast: null,
        reasonUnavailable: null,
      }),
    ).toEqual({
      estimate: { kind: "range", max: 3, min: 2, unit: "weeks" },
      kind: "estimate",
    });
  });

  it("hides the forecast on an empty queue", () => {
    expect(
      toQueueVolumeForecast({
        daysMax: null,
        daysMin: null,
        daysUntilForecast: null,
        reasonUnavailable: "empty_queue",
      }),
    ).toEqual({ kind: "hidden" });
  });

  it("hides the forecast when coverage is too low", () => {
    expect(
      toQueueVolumeForecast({
        daysMax: null,
        daysMin: null,
        daysUntilForecast: null,
        reasonUnavailable: "insufficient_coverage",
      }),
    ).toEqual({ kind: "hidden" });
  });

  it("counts down when history is still too short", () => {
    expect(
      toQueueVolumeForecast({
        daysMax: null,
        daysMin: null,
        daysUntilForecast: 19,
        reasonUnavailable: "insufficient_history",
      }),
    ).toEqual({ days: 19, kind: "countdown" });
  });

  it("asks for progress updates when waiting will not help", () => {
    expect(
      toQueueVolumeForecast({
        daysMax: null,
        daysMin: null,
        daysUntilForecast: null,
        reasonUnavailable: "insufficient_history",
      }),
    ).toEqual({ kind: "note", note: "updateProgress" });
  });

  it("reports missing volume data", () => {
    expect(
      toQueueVolumeForecast({
        daysMax: null,
        daysMin: null,
        daysUntilForecast: null,
        reasonUnavailable: "no_volume_data",
      }),
    ).toEqual({ kind: "note", note: "noVolumeData" });
  });

  it("maps stale activity and zero pace onto the same note", () => {
    const stale = toQueueVolumeForecast({
      daysMax: null,
      daysMin: null,
      daysUntilForecast: null,
      reasonUnavailable: "stale_activity",
    });
    const zeroPace = toQueueVolumeForecast({
      daysMax: null,
      daysMin: null,
      daysUntilForecast: null,
      reasonUnavailable: "zero_pace",
    });

    expect(stale).toEqual({ kind: "note", note: "staleActivity" });
    expect(zeroPace).toEqual(stale);
  });

  it("hides the forecast when the reason is cleared but the range is missing", () => {
    expect(
      toQueueVolumeForecast({
        daysMax: null,
        daysMin: null,
        daysUntilForecast: null,
        reasonUnavailable: null,
      }),
    ).toEqual({ kind: "hidden" });
  });
});
