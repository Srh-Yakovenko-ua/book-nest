import "@testing-library/jest-dom/vitest";

import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import {
  makePublisherListItem,
  makePublishersPage,
  makePublishersSummary,
} from "../model/publisher.fixtures";
import { AllPublishers } from "./all-publishers";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/publishers",
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const fetchMock = vi.fn();

let respondToList: () => Response;
let respondToSummary: () => Response;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderList(search = "", onUrlUpdate?: OnUrlUpdateFunction) {
  return renderWithProviders(
    <NuqsTestingAdapter onUrlUpdate={onUrlUpdate} searchParams={search}>
      <AllPublishers />
    </NuqsTestingAdapter>,
  );
}

function trackUrl() {
  const events: UrlUpdateEvent[] = [];
  const onUrlUpdate: OnUrlUpdateFunction = (event) => {
    events.push(event);
  };
  return { events, onUrlUpdate };
}

beforeEach(() => {
  respondToList = () => jsonResponse(makePublishersPage([makePublisherListItem()]));
  respondToSummary = () => jsonResponse(makePublishersSummary());

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/publishers/library/summary")) return Promise.resolve(respondToSummary());
    if (url.includes("/api/publishers/library")) return Promise.resolve(respondToList());
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AllPublishers", () => {
  it("renders a card for each publisher on the page", async () => {
    respondToList = () =>
      jsonResponse(
        makePublishersPage([
          makePublisherListItem({ id: "vivat", name: "Vivat" }),
          makePublisherListItem({ id: "ranok", name: "Ранок" }),
        ]),
      );

    renderList();

    expect(await screen.findByRole("link", { name: "Vivat" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ранок" })).toBeInTheDocument();
  });

  it("shows the library summary counts above the list", async () => {
    respondToSummary = () => jsonResponse(makePublishersSummary({ booksWithPublisherCount: 340 }));

    renderList();

    expect(await screen.findByText("Видавництв")).toBeInTheDocument();
    expect(screen.getByText("Книг із видавництвом")).toBeInTheDocument();
    expect(screen.getByText("340")).toBeInTheDocument();
  });

  it("renders the grid of cards by default", async () => {
    renderList();

    expect(await screen.findByText("Переглянути")).toBeInTheDocument();
    expect(screen.queryByText("Рейтинг")).not.toBeInTheDocument();
  });

  it("renders rows when the list view is selected", async () => {
    renderList("?view=list");

    expect(await screen.findByText("Рейтинг")).toBeInTheDocument();
    expect(screen.queryByText("Переглянути")).not.toBeInTheDocument();
  });

  it("shows the no-results state with a clear action when a search matches nothing", async () => {
    respondToList = () => jsonResponse(makePublishersPage([]));

    renderList("?search=невідоме");

    expect(await screen.findByText("Нічого не знайдено")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скинути фільтри" })).toBeInTheDocument();
    expect(screen.queryByText("Видавництв поки немає")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no publishers and no active query", async () => {
    respondToList = () => jsonResponse(makePublishersPage([]));

    renderList();

    expect(await screen.findByText("Видавництв поки немає")).toBeInTheDocument();
    expect(screen.queryByText("Нічого не знайдено")).not.toBeInTheDocument();
  });

  it("announces a failed list load and offers a retry", async () => {
    respondToList = () => jsonResponse({ message: "boom" }, 500);

    renderList();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Не вдалося завантажити видавництва");
  });

  it("surfaces the books-without-publisher banner when the summary reports some", async () => {
    respondToSummary = () => jsonResponse(makePublishersSummary({ booksWithoutPublisherCount: 3 }));

    renderList();

    expect(await screen.findByText("3 книги без видавництва")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Переглянути книги" })).toHaveAttribute(
      "href",
      "/books?publisherPresence=missing",
    );
  });

  it("hides the banner when every book already has a publisher", async () => {
    respondToSummary = () => jsonResponse(makePublishersSummary({ booksWithoutPublisherCount: 0 }));

    renderList();

    await screen.findByRole("link", { name: "Vivat" });
    expect(screen.queryByText("Переглянути книги")).not.toBeInTheDocument();
  });

  it("resets the page when a filter is toggled", async () => {
    const { events, onUrlUpdate } = trackUrl();
    renderList("?page=3", onUrlUpdate);

    await userEvent.click(await screen.findByRole("button", { name: "Є серії" }));

    await waitFor(() => expect(events.length).toBeGreaterThan(0));
    const params = events.at(-1)?.searchParams;
    expect(params?.get("hasSeries")).toBe("true");
    expect(params?.get("page")).toBeNull();
  });

  it("moves the search into the url and resets the page", async () => {
    const { events, onUrlUpdate } = trackUrl();
    renderList("?page=3", onUrlUpdate);

    await userEvent.type(await screen.findByRole("textbox", { name: "Пошук видавництв" }), "видав");

    await waitFor(() => expect(events.length).toBeGreaterThan(0));
    const params = events.at(-1)?.searchParams;
    expect(params?.get("search")).toBe("видав");
    expect(params?.get("page")).toBeNull();
  });

  it("changes the sort and resets the page", async () => {
    const { events, onUrlUpdate } = trackUrl();
    renderList("?page=3", onUrlUpdate);

    await userEvent.click(await screen.findByRole("combobox", { name: "Сортування" }));
    await userEvent.click(await screen.findByRole("option", { name: "Назва" }));

    await waitFor(() => expect(events.length).toBeGreaterThan(0));
    const params = events.at(-1)?.searchParams;
    expect(params?.get("sort")).toBe("name");
    expect(params?.get("page")).toBeNull();
  });

  it("sends the reader to the new-book form from the header action", async () => {
    renderList();

    await userEvent.click(await screen.findByRole("button", { name: "Додати книгу" }));

    expect(pushMock).toHaveBeenCalledWith("/books/new");
  });
});
