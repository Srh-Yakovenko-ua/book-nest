import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor } from "storybook/test";

import { AuthLayout } from "./auth-layout";
import { ForgotPasswordForm } from "./forgot-password-form";

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
  component: ForgotPasswordForm,
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
  title: "Auth/ForgotPasswordForm",
} satisfies Meta<typeof ForgotPasswordForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText(/пошта|email/i)).toBeVisible();
    await expect(canvas.getByRole("button", { name: /надіслати|send/i })).toBeVisible();
    const requestStep = canvas.getByRole("button", { name: /запит|request/i });
    await expect(requestStep).toHaveAttribute("aria-current", "step");
  },
};

export const NeutralSuccess: Story = {
  beforeEach: () => {
    mockFetch(200, { status: "reset_email_sent" });
  },
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText(/пошта|email/i), "reader@example.com");
    await userEvent.click(canvas.getByRole("button", { name: /надіслати інструкції|send/i }));
    await waitFor(async () => {
      await expect(canvas.getByText(/перевір свою пошту|check your inbox/i)).toBeVisible();
    });
    await expect(canvas.getByText(/такий акаунт існує|such an account exists/i)).toBeVisible();
    const emailStep = canvas.getByRole("button", { name: /пошта|email/i });
    await expect(emailStep).toHaveAttribute("aria-current", "step");
    await expect(canvas.getByRole("button", { name: /ще раз|resend in/i })).toBeVisible();
  },
};

export const BackToRequestStep: Story = {
  beforeEach: () => {
    mockFetch(200, { status: "reset_email_sent" });
  },
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText(/пошта|email/i), "reader@example.com");
    await userEvent.click(canvas.getByRole("button", { name: /надіслати інструкції|send/i }));
    await waitFor(async () => {
      await expect(canvas.getByText(/перевір свою пошту|check your inbox/i)).toBeVisible();
    });
    await userEvent.click(canvas.getByRole("button", { name: /запит|^request/i }));
    await waitFor(async () => {
      await expect(canvas.getByLabelText(/пошта|email/i)).toBeVisible();
    });
  },
};
