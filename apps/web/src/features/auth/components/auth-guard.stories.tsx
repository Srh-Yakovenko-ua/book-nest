import type { UserView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { useAuthStore } from "../model/auth-store";
import { AuthGuard } from "./auth-guard";

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

const ProtectedContent = () => <p data-testid="protected">Protected content</p>;

const meta = {
  args: { children: <ProtectedContent /> },
  component: AuthGuard,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
  },
  tags: ["ai-generated"],
  title: "Auth/AuthGuard",
} satisfies Meta<typeof AuthGuard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  beforeEach: () => {
    useAuthStore.getState().setStatus("loading");
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toBeVisible();
    await expect(canvas.queryByTestId("protected")).not.toBeInTheDocument();
  },
};

export const Authenticated: Story = {
  beforeEach: () => {
    useAuthStore.getState().setSession("test-access-token", reader);
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByTestId("protected")).toBeVisible();
    });
  },
};

export const Unauthenticated: Story = {
  beforeEach: () => {
    useAuthStore.getState().clearSession();
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toBeVisible();
    await expect(canvas.queryByTestId("protected")).not.toBeInTheDocument();
  },
};
