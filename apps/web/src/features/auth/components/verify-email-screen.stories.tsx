import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { AuthLayout } from "./auth-layout";
import { VerifyEmailScreen } from "./verify-email-screen";

function mockFetch(status: number, body: unknown) {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
        status,
      }),
    )) as typeof fetch;
}

const verifiedUser = {
  createdAt: "2026-01-01T00:00:00.000Z",
  dateOfBirth: null,
  email: "reader@example.com",
  emailVerified: true,
  id: "u_1",
  name: "Ada Lovelace",
  nickname: null,
  role: "user",
};

const meta = {
  component: VerifyEmailScreen,
  decorators: [
    (Story) => (
      <AuthLayout cover="/auth/cover-login.webp" tagline="your cozy reading corner">
        <Story />
      </AuthLayout>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
  },
  tags: ["ai-generated"],
  title: "Auth/VerifyEmailScreen",
} satisfies Meta<typeof VerifyEmailScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MissingToken: Story = {
  args: { token: "" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/недійсне|invalid or has expired/i)).toBeVisible();
    await expect(canvas.getByRole("button", { name: /надіслати повторно|resend/i })).toBeVisible();
  },
};

export const InvalidToken: Story = {
  args: { token: "expired-token" },
  beforeEach: () => {
    mockFetch(400, { message: "Invalid token", requestId: "test" });
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByText(/недійсне|invalid or has expired/i)).toBeVisible();
    });
  },
};

export const Success: Story = {
  args: { token: "valid-token" },
  beforeEach: () => {
    mockFetch(200, { accessToken: "token", user: verifiedUser });
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByText(/e-mail підтверджено|email has been verified/i)).toBeVisible();
    });
  },
};
