import { describe, expect, it } from "vitest";

import { isTrustedOrigin } from "./trusted-origin.js";

const trustedOrigins = ["https://book-nest.net", "http://localhost:3000"];

describe("isTrustedOrigin", () => {
  it("accepts an origin that matches a configured entry", () => {
    expect(
      isTrustedOrigin({
        origin: "https://book-nest.net",
        secFetchSite: undefined,
        trustedOrigins,
      }),
    ).toBe(true);
  });

  it("accepts an origin that differs only by a trailing slash", () => {
    expect(
      isTrustedOrigin({
        origin: "https://book-nest.net/",
        secFetchSite: undefined,
        trustedOrigins,
      }),
    ).toBe(true);
  });

  it("accepts an origin that differs only by letter case", () => {
    expect(
      isTrustedOrigin({
        origin: "HTTPS://Book-Nest.NET",
        secFetchSite: undefined,
        trustedOrigins,
      }),
    ).toBe(true);
  });

  it("rejects a foreign origin", () => {
    expect(
      isTrustedOrigin({
        origin: "https://evil.example",
        secFetchSite: "same-origin",
        trustedOrigins,
      }),
    ).toBe(false);
  });

  it("accepts an absent origin when the fetch site is same-origin", () => {
    expect(
      isTrustedOrigin({
        origin: undefined,
        secFetchSite: "same-origin",
        trustedOrigins,
      }),
    ).toBe(true);
  });

  it("rejects an absent origin when the fetch site is cross-site", () => {
    expect(
      isTrustedOrigin({
        origin: undefined,
        secFetchSite: "cross-site",
        trustedOrigins,
      }),
    ).toBe(false);
  });

  it("rejects a request that carries neither header", () => {
    expect(
      isTrustedOrigin({
        origin: undefined,
        secFetchSite: undefined,
        trustedOrigins,
      }),
    ).toBe(false);
  });
});
