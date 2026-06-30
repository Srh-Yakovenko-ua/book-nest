import type { UserView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { useAuthStore } from "@/features/auth";

import { SessionMenu } from "./session-menu";

const reader: UserView = {
  createdAt: "2026-01-01T00:00:00.000Z",
  dateOfBirth: null,
  email: "reader@example.com",
  emailVerified: true,
  id: "user-1",
  name: "Solomiya Koval",
  nickname: "solo",
  role: "user",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockFetch(handler: (path: string, init?: RequestInit) => Promise<Response> | Response) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const path = typeof input === "string" ? input : input.toString();
    return Promise.resolve(handler(path, init));
  }) as typeof fetch;
}

const meta = {
  component: SessionMenu,
  parameters: {
    layout: "centered",
    nextjs: { appDirectory: true },
  },
  tags: ["ai-generated"],
  title: "Shell/SessionMenu",
} satisfies Meta<typeof SessionMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  beforeEach: () => {
    useAuthStore.getState().setStatus("loading");
  },
  play: async ({ canvasElement }) => {
    await waitFor(async () => {
      await expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    });
  },
};

export const Unauthenticated: Story = {
  beforeEach: () => {
    useAuthStore.getState().clearSession();
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: /увійти/i })).toBeVisible();
    await expect(canvas.getByRole("link", { name: /зареєструватися/i })).toBeVisible();
  },
};

export const Authenticated: Story = {
  beforeEach: () => {
    useAuthStore.getState().setSession("test-access-token", reader);
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("SK")).toBeVisible();
    const trigger = canvas.getByRole("button", { name: /меню акаунта/i });
    await userEvent.click(trigger);

    const menu = within(document.body);
    await waitFor(async () => {
      await expect(menu.getByText(reader.name)).toBeVisible();
    });
    await expect(menu.getByText(reader.email)).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /вийти/i })).toBeVisible();
  },
};

export const LogoutFlow: Story = {
  beforeEach: () => {
    useAuthStore.getState().setSession("test-access-token", reader);
    mockFetch(() => jsonResponse(200, { status: "logged_out" }));
  },
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: /меню акаунта/i });
    await userEvent.click(trigger);

    const menu = within(document.body);
    const signOut = await menu.findByRole("menuitem", { name: /вийти/i });
    await userEvent.click(signOut);

    await waitFor(async () => {
      await expect(canvas.getByRole("link", { name: /увійти/i })).toBeVisible();
    });
  },
};
