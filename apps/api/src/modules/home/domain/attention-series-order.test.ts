import type { SeriesOrderSeverity } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { SeriesOrderIssueSignal } from "./attention-series-order.js";

import { buildSeriesOrderAttention } from "./attention-series-order.js";

const SERIES = {
  discworld: { id: "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c81", title: "Discworld" },
  earthsea: { id: "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c82", title: "Earthsea" },
} as const;

function issue(
  severity: SeriesOrderSeverity,
  series: SeriesOrderIssueSignal["series"] = SERIES.discworld,
): SeriesOrderIssueSignal {
  return { series, severity };
}

describe("buildSeriesOrderAttention", () => {
  it("raises a series order error as medium, counted in issues", () => {
    expect(buildSeriesOrderAttention([issue("error")])).toEqual([
      expect.objectContaining({
        count: 1,
        reason: "series_order_issue",
        severity: "medium",
        unit: "issues",
      }),
    ]);
  });

  it("raises a series order warning as low", () => {
    expect(buildSeriesOrderAttention([issue("warning")])).toEqual([
      expect.objectContaining({ reason: "series_order_issue", severity: "low" }),
    ]);
  });

  it("raises nothing for an informational series order note", () => {
    expect(buildSeriesOrderAttention([issue("info")])).toEqual([]);
  });

  it("groups issues of the same severity into one group", () => {
    const groups = buildSeriesOrderAttention([
      issue("error", SERIES.discworld),
      issue("warning", SERIES.discworld),
      issue("error", SERIES.earthsea),
      issue("info", SERIES.earthsea),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ count: 2, severity: "medium" }),
        expect.objectContaining({ count: 1, severity: "low" }),
      ]),
    );
  });
});
