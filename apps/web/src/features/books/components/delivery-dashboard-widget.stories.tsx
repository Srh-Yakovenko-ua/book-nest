import type { InTransitSummaryView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { getQueryClient } from "@/lib/query-client";

import { DeliveryDashboardWidget } from "./delivery-dashboard-widget";

type Handler = (path: string) => Response;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function makeSummary(overrides: Partial<InTransitSummaryView> = {}): InTransitSummaryView {
  return {
    activeBooksCount: 0,
    activeBooksTotalByCurrency: [],
    activeOrdersCount: 0,
    activeOrdersTotalByCurrency: [],
    activeShipmentsCount: 0,
    attentionCount: 0,
    delayedCount: 0,
    expectedThisWeekCount: 0,
    inTransitCount: 0,
    nextExpectedDelivery: null,
    orderedCount: 0,
    readyForPickupCount: 0,
    uniqueStoresCount: 0,
    withoutExpectedDateCount: 0,
    withoutPriceCount: 0,
    withoutTrackingCount: 0,
    ...overrides,
  };
}

function mockFetch(handler: Handler) {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const path = typeof input === "string" ? input : input.toString();
    return Promise.resolve(handler(path));
  }) as typeof fetch;
}

function summaryHandler(summary: InTransitSummaryView): Handler {
  return (path) =>
    path.includes("/api/delivery/books/in-transit/summary")
      ? jsonResponse(200, summary)
      : jsonResponse(200, {});
}

const meta = {
  component: DeliveryDashboardWidget,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-xl p-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
  },
  tags: ["ai-generated"],
  title: "Books/DeliveryDashboardWidget",
} satisfies Meta<typeof DeliveryDashboardWidget>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithActiveDeliveries: Story = {
  beforeEach: () => {
    getQueryClient().clear();
    mockFetch(
      summaryHandler(
        makeSummary({
          activeBooksCount: 5,
          activeBooksTotalByCurrency: [{ currency: "UAH", total: 1450 }],
          delayedCount: 1,
          expectedThisWeekCount: 2,
          uniqueStoresCount: 3,
        }),
      ),
    );
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("5")).toBeVisible();
    await expect(canvas.getByText("2")).toBeVisible();
    await expect(canvas.getByText("1")).toBeVisible();
    await expect(canvas.getByRole("link").getAttribute("href")).toContain("/delivery/in-transit");
  },
};

export const HiddenWhenEmpty: Story = {
  beforeEach: () => {
    getQueryClient().clear();
    mockFetch(summaryHandler(makeSummary()));
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.queryByText("Доставки в дорозі")).toBeNull());
  },
};
