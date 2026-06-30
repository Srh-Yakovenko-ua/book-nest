import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor } from "storybook/test";

import { AuthLayout } from "./auth-layout";
import { ResendVerificationForm } from "./resend-verification-form";

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
  component: ResendVerificationForm,
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
  title: "Auth/ResendVerificationForm",
} satisfies Meta<typeof ResendVerificationForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText(/пошта|email/i)).toBeVisible();
    await expect(canvas.getByRole("button", { name: /надіслати повторно|resend/i })).toBeVisible();
  },
};

export const Success: Story = {
  beforeEach: () => {
    mockFetch(201, { email: "reader@example.com", status: "verification_sent" });
  },
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText(/пошта|email/i), "reader@example.com");
    await userEvent.click(canvas.getByRole("button", { name: /надіслати повторно|resend/i }));
    await waitFor(async () => {
      await expect(
        canvas.getByText(/лист.*надіслано|confirmation email has been sent/i),
      ).toBeVisible();
    });
  },
};
