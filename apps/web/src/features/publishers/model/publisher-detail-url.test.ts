import { createLoader } from "nuqs/server";
import { describe, expect, it, vi } from "vitest";

import {
  publisherBooksUrl,
  publisherDetailUrlNormalization,
  publisherDetailUrlParsers,
  resolvePublisherDetailTab,
} from "./publisher-detail-url";

vi.mock("@/i18n/navigation", () => ({}));

const loadDetailUrl = createLoader(publisherDetailUrlParsers);

function normalize(search: string) {
  return publisherDetailUrlNormalization(loadDetailUrl(search));
}

describe("resolvePublisherDetailTab", () => {
  it("maps the books and legacy wishlist tabs to books", () => {
    expect(resolvePublisherDetailTab("books")).toBe("books");
    expect(resolvePublisherDetailTab("toBuy")).toBe("books");
  });

  it("falls back to overview for a missing or unknown tab", () => {
    expect(resolvePublisherDetailTab(null)).toBe("overview");
    expect(resolvePublisherDetailTab("overview")).toBe("overview");
    expect(resolvePublisherDetailTab("stats")).toBe("overview");
  });
});

describe("publisherDetailUrlNormalization", () => {
  it("leaves a clean overview url alone", () => {
    expect(normalize("")).toBeNull();
  });

  it("leaves a books url with books params alone", () => {
    expect(normalize("?q=dune&sort=title_asc&tab=books")).toBeNull();
  });

  it("turns the legacy wishlist tab into books filtered to the wishlist", () => {
    expect(normalize("?tab=toBuy")).toEqual({
      owner: ["want_to_buy"],
      publisher: null,
      tab: "books",
    });
  });

  it("cleans an explicit overview tab", () => {
    const patch = normalize("?tab=overview");
    expect(patch?.tab).toBeNull();
  });

  it("cleans an unknown tab together with any books params", () => {
    const patch = normalize("?q=dune&tab=stats");
    expect(patch).toMatchObject({ q: null, tab: null });
  });

  it("cleans books-only params from the overview url", () => {
    expect(normalize("?status=reading&view=list")).toMatchObject({
      status: null,
      view: null,
    });
  });

  it("drops a publisher param from the books url", () => {
    expect(normalize("?publisher=p-1&tab=books")).toEqual({
      publisher: null,
    });
  });
});

describe("publisherBooksUrl", () => {
  it("opens books with every books param reset", () => {
    expect(publisherBooksUrl()).toMatchObject({ owner: null, q: null, sort: null, tab: "books" });
  });
});
