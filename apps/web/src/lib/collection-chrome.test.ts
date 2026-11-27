import { describe, expect, it } from "vitest";

import { collectionChrome } from "./collection-chrome";

describe("collectionChrome", () => {
  it.each([
    {
      baseTotal: 0,
      case: "hides metrics and tools when the base collection is empty",
      expected: { showMetrics: false, showTools: false },
      hasQuery: false,
    },
    {
      baseTotal: 0,
      case: "keeps the tools for a reset path when the empty base still carries a query",
      expected: { showMetrics: false, showTools: true },
      hasQuery: true,
    },
    {
      baseTotal: undefined,
      case: "keeps metrics and tools while the base total is pending or failed",
      expected: { showMetrics: true, showTools: true },
      hasQuery: false,
    },
    {
      baseTotal: 3,
      case: "shows metrics and tools once the base collection has records",
      expected: { showMetrics: true, showTools: true },
      hasQuery: false,
    },
    {
      baseTotal: 3,
      case: "shows metrics and tools when records exist and a query matched nothing",
      expected: { showMetrics: true, showTools: true },
      hasQuery: true,
    },
  ])("$case", ({ baseTotal, expected, hasQuery }) => {
    expect(collectionChrome({ baseTotal, hasQuery })).toEqual(expected);
  });
});
