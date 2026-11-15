import { describe, expect, it } from "vitest";

import { infiniteScrollStateOf } from "./use-infinite-scroll-sentinel";

describe("infiniteScrollStateOf", () => {
  it("reports loading while the next page is being fetched", () => {
    expect(
      infiniteScrollStateOf({
        hasNextPage: true,
        isFetchingNextPage: true,
        isFetchNextPageError: false,
      }),
    ).toBe("loading");
  });

  it("reports an error when the next page failed and nothing is fetching", () => {
    expect(
      infiniteScrollStateOf({
        hasNextPage: true,
        isFetchingNextPage: false,
        isFetchNextPageError: true,
      }),
    ).toBe("error");
  });

  it("reports loading while a failed next page is being retried", () => {
    expect(
      infiniteScrollStateOf({
        hasNextPage: true,
        isFetchingNextPage: true,
        isFetchNextPageError: true,
      }),
    ).toBe("loading");
  });

  it("stays idle while more pages remain", () => {
    expect(
      infiniteScrollStateOf({
        hasNextPage: true,
        isFetchingNextPage: false,
        isFetchNextPageError: false,
      }),
    ).toBe("idle");
  });

  it("reports none once the last page has loaded", () => {
    expect(
      infiniteScrollStateOf({
        hasNextPage: false,
        isFetchingNextPage: false,
        isFetchNextPageError: false,
      }),
    ).toBe("none");
  });
});
