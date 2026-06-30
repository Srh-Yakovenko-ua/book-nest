import type { UserView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { useAuthStore } from "@/features/auth";
import { getQueryClient } from "@/lib/query-client";

import { HomeDashboard } from "./home-dashboard";

type Handler = (path: string, init?: RequestInit) => Promise<Response> | Response;

type OverviewSummary = {
  favorites: number;
  finished: number;
  reading: number;
  total: number;
};

const reader: UserView = {
  createdAt: "2026-01-01T00:00:00.000Z",
  dateOfBirth: null,
  email: "serhii@example.com",
  emailVerified: true,
  id: "user-1",
  name: "Serhii Yakovenko",
  nickname: "Serhii",
  role: "user",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockFetch(handler: Handler) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const path = typeof input === "string" ? input : input.toString();
    return Promise.resolve(handler(path, init));
  }) as typeof fetch;
}

function overviewHandler(summary: OverviewSummary): Handler {
  return (path) => {
    if (path.includes("/api/books/overview")) {
      return jsonResponse(200, { recentlyAdded: [], summary, topGenres: [], topTags: [] });
    }
    return jsonResponse(200, {});
  };
}

const meta = {
  component: HomeDashboard,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-6xl p-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
  },
  tags: ["ai-generated"],
  title: "Books/HomeDashboard",
} satisfies Meta<typeof HomeDashboard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithLibrary: Story = {
  beforeEach: () => {
    getQueryClient().clear();
    useAuthStore.getState().setSession("test-access-token", reader);
    mockFetch(overviewHandler({ favorites: 12, finished: 48, reading: 3, total: 124 }));
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Привіт, Serhii!")).toBeVisible();
    await expect(await canvas.findByText("124")).toBeVisible();
    await expect(await canvas.findByText("Прочитано 48 з 124")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Додати книгу" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "До бібліотеки" })).toBeVisible();
  },
};

export const EmptyLibrary: Story = {
  beforeEach: () => {
    getQueryClient().clear();
    useAuthStore.getState().setSession("test-access-token", reader);
    mockFetch(overviewHandler({ favorites: 0, finished: 0, reading: 0, total: 0 }));
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Бібліотека поки порожня")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Додати першу книгу" })).toBeVisible();
  },
};
