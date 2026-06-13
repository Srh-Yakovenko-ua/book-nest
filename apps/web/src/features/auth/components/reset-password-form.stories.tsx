import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor } from "storybook/test";

import { AuthLayout } from "./auth-layout";
import { ResetPasswordForm } from "./reset-password-form";

function mockFetch(status: number, body: unknown) {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
        status,
      }),
    )) as typeof fetch;
}

const meta = {
  component: ResetPasswordForm,
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
  title: "Auth/ResetPasswordForm",
} satisfies Meta<typeof ResetPasswordForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { token: "valid-token" },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText(/новий пароль|new password/i)).toBeVisible();
    await expect(canvas.getByRole("button", { name: /зберегти|save/i })).toBeVisible();
  },
};

export const MissingToken: Story = {
  args: { token: "" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/недійсне|invalid or has expired/i)).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /зберегти|save/i })).toBeNull();
  },
};

export const Success: Story = {
  args: { token: "valid-token" },
  beforeEach: () => {
    mockFetch(200, { status: "password_reset" });
  },
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText(/новий пароль|new password/i), "Secret123!");
    await userEvent.type(canvas.getByLabelText(/підтвердження|confirm/i), "Secret123!");
    await userEvent.click(canvas.getByRole("button", { name: /зберегти|save/i }));
    await waitFor(async () => {
      await expect(canvas.getByText(/пароль змінено|has been changed/i)).toBeVisible();
    });
  },
};
