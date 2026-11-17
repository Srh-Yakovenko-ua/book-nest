import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { listKeys } from "../api/list-keys";
import { makeCustomListDetail, makeListOverviewView } from "../model/lists.fixtures";
import { ListDetails } from "./list-details";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const LIST_ID = "list-1";
const LIST_NAME = "Осіннє читання";

const common = messages.common;
const states = messages.lists.details.states;

const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();

let detailStatus: number;

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  );
}

function reply(input: RequestInfo | URL): Promise<Response> {
  const { pathname } = new URL(String(input), "http://localhost");
  if (pathname === `/api/lists/${LIST_ID}`) {
    if (detailStatus !== 200) return json({ message: "boom" }, detailStatus);
    return json(makeCustomListDetail({ id: LIST_ID, name: LIST_NAME }));
  }
  if (pathname.startsWith("/api/genres")) return json([]);
  if (pathname.endsWith("/facets")) return json({ authors: [], genres: [] });
  if (pathname.endsWith("/overview")) return json(makeListOverviewView());
  if (pathname.endsWith("/related")) return json({ lists: [] });
  return Promise.reject(new Error(`unexpected fetch: ${pathname}`));
}

beforeEach(() => {
  detailStatus = 200;
  fetchMock.mockReset();
  fetchMock.mockImplementation(reply);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ListDetails", () => {
  it("keeps the loaded list and shows the refresh banner when a refetch fails", async () => {
    const { queryClient } = renderWithProviders(
      <NuqsTestingAdapter>
        <ListDetails id={LIST_ID} />
      </NuqsTestingAdapter>,
    );
    await screen.findByRole("heading", { level: 1, name: LIST_NAME });

    detailStatus = 500;
    await act(() => queryClient.invalidateQueries({ queryKey: listKeys.detail(LIST_ID) }));

    expect(await screen.findByText(common.refetchError)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: LIST_NAME })).toBeInTheDocument();
  });

  it("moves focus to the list name when a retried first load succeeds", async () => {
    detailStatus = 500;
    renderWithProviders(
      <NuqsTestingAdapter>
        <ListDetails id={LIST_ID} />
      </NuqsTestingAdapter>,
    );
    await screen.findByRole("heading", { name: states.errorTitle });

    detailStatus = 200;
    await userEvent.click(screen.getByRole("button", { name: common.retry }));

    expect(await screen.findByRole("heading", { level: 1, name: LIST_NAME })).toHaveFocus();
  });
});
