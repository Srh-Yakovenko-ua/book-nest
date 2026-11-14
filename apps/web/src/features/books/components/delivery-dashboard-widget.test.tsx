import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeDeliveryInTransitSummary } from "@/features/delivery/components/delivery.fixtures";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { DeliveryDashboardWidget } from "./delivery-dashboard-widget";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const SUMMARY_PATH = "/api/delivery/books/in-transit/summary";

const deliveryCopy = messages.home.delivery;
const summaryError = messages.common.summaryError;

const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();

let respondToSummary: () => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function summaryRequestCount(): number {
  return fetchMock.mock.calls.filter(
    ([input]) => new URL(String(input), "http://localhost").pathname === SUMMARY_PATH,
  ).length;
}

beforeEach(() => {
  respondToSummary = () =>
    Promise.resolve(jsonResponse(makeDeliveryInTransitSummary({ activeBooksCount: 5 })));
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === SUMMARY_PATH) return respondToSummary();
    return Promise.reject(new Error(`unexpected fetch: ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DeliveryDashboardWidget", () => {
  it("links the deliveries in transit once the summary arrives", async () => {
    renderWithProviders(<DeliveryDashboardWidget />);

    expect(await screen.findByRole("heading", { name: deliveryCopy.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: deliveryCopy.viewAll })).toHaveAttribute(
      "href",
      "/delivery/in-transit",
    );
  });

  it("holds a busy loading card while the summary is on its way", () => {
    respondToSummary = () => new Promise<Response>(() => {});

    renderWithProviders(<DeliveryDashboardWidget />);

    expect(screen.getByRole("status", { name: deliveryCopy.loading })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByRole("heading", { name: deliveryCopy.title })).not.toBeInTheDocument();
  });

  it("shows the summary error with a retry when the first load fails", async () => {
    respondToSummary = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderWithProviders(<DeliveryDashboardWidget />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(deliveryCopy.error.title);
    expect(within(alert).getByRole("button", { name: summaryError.retry })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: deliveryCopy.loading })).not.toBeInTheDocument();
  });

  it("describes the retry with the delivery error title", async () => {
    respondToSummary = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderWithProviders(<DeliveryDashboardWidget />);

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByRole("button", { name: summaryError.retry }),
    ).toHaveAccessibleDescription(deliveryCopy.error.title);
  });

  it("asks for the summary again from the retry and shows the widget it returns", async () => {
    respondToSummary = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderWithProviders(<DeliveryDashboardWidget />);

    const alert = await screen.findByRole("alert");
    respondToSummary = () =>
      Promise.resolve(jsonResponse(makeDeliveryInTransitSummary({ activeBooksCount: 5 })));
    await userEvent.click(within(alert).getByRole("button", { name: summaryError.retry }));

    expect(await screen.findByRole("heading", { name: deliveryCopy.title })).toBeInTheDocument();
    expect(summaryRequestCount()).toBe(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders nothing once the summary says no book is on its way", async () => {
    respondToSummary = () => Promise.resolve(jsonResponse(makeDeliveryInTransitSummary()));

    renderWithProviders(<DeliveryDashboardWidget />);

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(summaryRequestCount()).toBe(1);
  });

  it("keeps focus in the widget when a keyboard retry finds no book on its way", async () => {
    respondToSummary = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderWithProviders(<DeliveryDashboardWidget />);

    const retry = within(await screen.findByRole("alert")).getByRole("button", {
      name: summaryError.retry,
    });
    respondToSummary = () => Promise.resolve(jsonResponse(makeDeliveryInTransitSummary()));
    await userEvent.tab();
    expect(retry).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(summaryRequestCount()).toBe(2);
    expect(document.body).not.toHaveFocus();
    expect(document.activeElement).toBeInTheDocument();
  });
});
