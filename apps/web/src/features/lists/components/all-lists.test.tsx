import type { ListsSummaryView } from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { mockIntersectionObserver, renderWithProviders, screen, userEvent } from "@/test-utils";

import { listKeys } from "../api/list-keys";
import { makeCustomListCard } from "../model/lists.fixtures";
import { AllLists } from "./all-lists";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

mockIntersectionObserver();

const { summaryError } = messages.common;

const LIST_NAME = "Осіннє читання";

const LARGEST_LIST_FACT = "Найбільший список — 12 книг";

const SUMMARY: ListsSummaryView = {
  averageBooksPerList: 4,
  emptyListCount: 2,
  largestListBookCount: 12,
  listsWithBooksCount: 3,
  maxListsPerBook: 3,
  multiListBookCount: 5,
  noDescriptionListCount: 1,
  staleListCount: 0,
  totalListCount: 5,
  totalMembershipCount: 20,
  uniqueBookCount: 15,
};

const requestedPaths: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  requestedPaths.length = 0;
});

describe("AllLists summary", () => {
  it("shows the summary error card but keeps the lists when the summary fails", async () => {
    stubListsApi([500]);

    renderAllLists();

    expect(await screen.findByRole("link", { name: LIST_NAME })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(summaryError.title);
    expect(screen.getByRole("button", { name: summaryError.retry })).toBeInTheDocument();
    expect(screen.queryByText(LARGEST_LIST_FACT)).not.toBeInTheDocument();
  });

  it("loads the summary again and shows its numbers when retry is clicked", async () => {
    stubListsApi([500, 200]);
    renderAllLists();

    await userEvent.click(await screen.findByRole("button", { name: summaryError.retry }));

    expect(await screen.findByText(LARGEST_LIST_FACT)).toBeInTheDocument();
    expect(summaryRequests()).toHaveLength(2);
    expect(screen.queryByText(summaryError.title)).not.toBeInTheDocument();
  });

  it("keeps the loaded summary numbers when a summary refetch fails", async () => {
    stubListsApi([200, 500]);
    const { queryClient } = renderAllLists();
    expect(await screen.findByText(LARGEST_LIST_FACT)).toBeInTheDocument();

    await act(() => queryClient.refetchQueries({ queryKey: listKeys.summary }));

    expect(summaryRequests()).toHaveLength(2);
    expect(screen.getByText(LARGEST_LIST_FACT)).toBeInTheDocument();
    expect(screen.queryByText(summaryError.title)).not.toBeInTheDocument();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderAllLists() {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory>
      <AllLists />
    </NuqsTestingAdapter>,
  );
}

function stubListsApi(summaryStatuses: number[]) {
  const pendingStatuses = [...summaryStatuses];

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const path = new URL(url, "http://localhost").pathname;
      requestedPaths.push(path);

      if (path === "/api/lists/summary") {
        const status = pendingStatuses.shift() ?? 200;
        return Promise.resolve(status === 200 ? jsonResponse(SUMMARY) : jsonResponse({}, status));
      }
      if (path === "/api/lists") {
        return Promise.resolve(
          jsonResponse({
            items: [makeCustomListCard({ name: LIST_NAME })],
            page: 1,
            pagesCount: 1,
            pageSize: 20,
            totalCount: 1,
          }),
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

function summaryRequests(): string[] {
  return requestedPaths.filter((path) => path === "/api/lists/summary");
}
