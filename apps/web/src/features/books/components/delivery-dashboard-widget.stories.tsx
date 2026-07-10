import type { DeliveryInTransitSummaryView } from "@app/shared";
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

function mockFetch(handler: Handler) {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const path = typeof input === "string" ? input : input.toString();
    return Promise.resolve(handler(path));
  }) as typeof fetch;
}

function summaryHandler(summary: DeliveryInTransitSummaryView): Handler {
  return (path) =>
    path.includes("/api/delivery/in-transit/summary")
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
      summaryHandler({
        activeCount: 5,
        delayedCount: 1,
        expectedThisWeek: 2,
        totalByCurrency: [{ currency: "UAH", total: 1450 }],
        uniqueStores: 3,
      }),
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
    mockFetch(
      summaryHandler({
        activeCount: 0,
        delayedCount: 0,
        expectedThisWeek: 0,
        totalByCurrency: [],
        uniqueStores: 0,
      }),
    );
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.queryByText("Доставки в дорозі")).toBeNull());
  },
};
