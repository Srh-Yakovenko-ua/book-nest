import { createLoader } from "nuqs/server";
import { describe, expect, it, vi } from "vitest";

import { publisherDetailUrlNormalization, publisherDetailUrlParsers } from "./publisher-detail-url";

vi.mock("@/i18n/navigation", () => ({}));

const loadDetailUrl = createLoader(publisherDetailUrlParsers);

function normalize(search: string) {
  return publisherDetailUrlNormalization(loadDetailUrl(search));
}

describe("publisherDetailUrlNormalization", () => {
  it("leaves a clean detail url alone", () => {
    expect(normalize("")).toBeNull();
  });

  it("keeps catalog params that the archive owns", () => {
    expect(normalize("?q=dune&sort=title_asc&status=reading&view=list")).toBeNull();
  });

  it("drops a legacy books tab without touching the catalog params", () => {
    expect(normalize("?tab=books&q=dune")).toEqual({ tab: null });
  });

  it("drops a legacy overview tab", () => {
    expect(normalize("?tab=overview")).toEqual({ tab: null });
  });

  it("drops an unknown tab", () => {
    expect(normalize("?tab=stats")).toEqual({ tab: null });
  });

  it("turns the legacy wishlist tab into the wishlist owner filter", () => {
    expect(normalize("?tab=toBuy")).toEqual({
      owner: ["want_to_buy"],
      publisher: null,
      publisherPresence: null,
      tab: null,
    });
  });

  it("never keeps the fixed publisher as a url param", () => {
    expect(normalize("?publisher=p-1")).toEqual({ publisher: null, publisherPresence: null });
    expect(normalize("?publisher=p-1&tab=books")).toEqual({
      publisher: null,
      publisherPresence: null,
      tab: null,
    });
  });

  it("strips a publisher presence filter that this page already neutralises", () => {
    expect(normalize("?publisherPresence=missing")).toEqual({
      publisher: null,
      publisherPresence: null,
    });
    expect(normalize("?publisherPresence=assigned&tab=overview")).toEqual({
      publisher: null,
      publisherPresence: null,
      tab: null,
    });
  });

  it("leaves the default publisher presence alone", () => {
    expect(normalize("?publisherPresence=all")).toBeNull();
  });
});
