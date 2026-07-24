import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { getQueryClient } from "@/lib/query-client";

import { makeSeriesDetailsView } from "../model/series.fixtures";
import { SeriesDetails } from "./series-details";

const GENRES_FIXTURE = [
  { key: "fantasy", name: "Фентезі" },
  { key: "romance", name: "Романтика" },
].map((genre, index) => ({
  ...genre,
  groupKey: "fiction",
  groupName: "Художня література",
  id: `genre-${index}`,
  isDefault: true,
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockJson(status: number, body: unknown) {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const path = typeof input === "string" ? input : input.toString();
    if (path.includes("/api/genres")) return Promise.resolve(jsonResponse(200, GENRES_FIXTURE));
    return Promise.resolve(jsonResponse(status, body));
  }) as typeof fetch;
}

function mockPending() {
  globalThis.fetch = (() => new Promise<Response>(() => {})) as typeof fetch;
}

const meta = {
  component: SeriesDetails,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-6xl p-6">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  tags: ["ai-generated"],
  title: "Series/SeriesDetails",
} satisfies Meta<typeof SeriesDetails>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  args: { id: "series-loaded" },
  beforeEach: () => {
    getQueryClient().clear();
    mockJson(200, makeSeriesDetailsView({ id: "series-loaded" }));
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByRole("heading", { level: 1, name: "Емпіреї" })).toBeVisible();
    });
  },
};

export const Loading: Story = {
  args: { id: "series-loading" },
  beforeEach: () => {
    getQueryClient().clear();
    mockPending();
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Завантаження серії…")).toBeVisible();
  },
};

export const NotFound: Story = {
  args: { id: "series-missing" },
  beforeEach: () => {
    getQueryClient().clear();
    mockJson(404, { code: "not_found", message: "Series not found" });
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByRole("heading", { name: "Серію не знайдено" })).toBeVisible();
    });
    await expect(canvas.getByRole("button", { name: "Повернутися до серій" })).toBeVisible();
  },
};
