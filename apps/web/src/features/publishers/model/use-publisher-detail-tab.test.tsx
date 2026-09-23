import type { ReactNode } from "react";

import { renderHook, waitFor } from "@testing-library/react";
import { useQueryStates } from "nuqs";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import { libraryQueryParsers } from "@/features/books";

import { usePublisherDetailTab } from "./use-publisher-detail-tab";

vi.mock("@/i18n/navigation", () => ({}));

function renderAt(searchParams: string) {
  return renderHook(useDetailTabWithBooksCore, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NuqsTestingAdapter hasMemory searchParams={searchParams}>
        {children}
      </NuqsTestingAdapter>
    ),
  });
}

function useDetailTabWithBooksCore() {
  const [books] = useQueryStates(libraryQueryParsers);
  const { tab } = usePublisherDetailTab();
  return { books, tab };
}

describe("usePublisherDetailTab", () => {
  it("hands the books core a typed wishlist owner filter for the legacy toBuy tab", async () => {
    const { result } = renderAt("?tab=toBuy");

    await waitFor(() => expect(result.current.books.owner).toEqual(["want_to_buy"]));
    expect(result.current.tab).toBe("books");
    expect(result.current.books.publisher).toEqual([]);
  });

  it("hands the books core its defaults when leaving books for the overview", async () => {
    const { result } = renderAt("?view=list&owner=owned");

    await waitFor(() => expect(result.current.books.owner).toEqual([]));
    expect(result.current.books.view).toBe("grid");
    expect(result.current.tab).toBe("overview");
  });
});
