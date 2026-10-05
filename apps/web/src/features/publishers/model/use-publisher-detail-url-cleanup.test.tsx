import type { ReactNode } from "react";

import { renderHook, waitFor } from "@testing-library/react";
import { useQueryStates } from "nuqs";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import { libraryQueryParsers } from "@/features/books";

import { publisherDetailUrlParsers } from "./publisher-detail-url";
import { usePublisherDetailUrlCleanup } from "./use-publisher-detail-url-cleanup";

vi.mock("@/i18n/navigation", () => ({}));

function renderAt(searchParams: string) {
  return renderHook(useCleanedDetailUrl, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NuqsTestingAdapter hasMemory searchParams={searchParams}>
        {children}
      </NuqsTestingAdapter>
    ),
  });
}

function useCleanedDetailUrl() {
  const [books] = useQueryStates(libraryQueryParsers);
  const [detail] = useQueryStates(publisherDetailUrlParsers);
  usePublisherDetailUrlCleanup();
  return { books, tab: detail.tab };
}

describe("usePublisherDetailUrlCleanup", () => {
  it("hands the books core a typed wishlist owner filter for the legacy toBuy tab", async () => {
    const { result } = renderAt("?tab=toBuy");

    await waitFor(() => expect(result.current.books.owner).toEqual(["want_to_buy"]));
    expect(result.current.tab).toBeNull();
    expect(result.current.books.publisher).toEqual([]);
  });

  it("replaces a legacy books tab out of the url and keeps the catalog params", async () => {
    const { result } = renderAt("?tab=books&view=list&owner=owned");

    await waitFor(() => expect(result.current.tab).toBeNull());
    expect(result.current.books.view).toBe("list");
    expect(result.current.books.owner).toEqual(["owned"]);
  });

  it("leaves a clean catalog url untouched", () => {
    const { result } = renderAt("?q=dune");

    expect(result.current.tab).toBeNull();
    expect(result.current.books.q).toBe("dune");
  });
});
