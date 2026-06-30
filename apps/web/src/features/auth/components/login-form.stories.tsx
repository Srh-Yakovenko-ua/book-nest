import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor } from "storybook/test";

import { AuthLayout } from "./auth-layout";
import { LoginForm } from "./login-form";

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
  component: LoginForm,
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
  title: "Auth/LoginForm",
} satisfies Meta<typeof LoginForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(canvas.getByLabelText(/пошта|email/i)).toBeVisible();
    await expect(canvas.getByRole("button", { name: /увійти|sign in/i })).toBeVisible();
  },
};

export const ValidationOnEmptySubmit: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: /увійти|sign in/i }));
    await waitFor(async () => {
      const alerts = await canvas.findAllByRole("alert");
      await expect(alerts.length).toBeGreaterThan(0);
    });
    await expect(canvas.getByLabelText(/пошта|email/i)).toHaveAttribute("aria-invalid", "true");
  },
};

export const InvalidCredentials: Story = {
  beforeEach: () => {
    mockFetch(() => jsonResponse(401, { message: "Invalid credentials", requestId: "test" }));
  },
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText(/пошта|email/i), "reader@example.com");
    await userEvent.type(canvas.getByLabelText(/^(пароль|password)$/i), "Secret123!");
    await userEvent.click(canvas.getByRole("button", { name: /увійти|sign in/i }));
    await waitFor(async () => {
      await expect(canvas.getByText(/невірна пошта|invalid email or password/i)).toBeVisible();
    });
  },
};

export const EmailNotVerified: Story = {
  beforeEach: () => {
    mockFetch(() =>
      jsonResponse(403, {
        code: "email_not_verified",
        message: "Email not verified",
        requestId: "test",
      }),
    );
  },
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText(/пошта|email/i), "reader@example.com");
    await userEvent.type(canvas.getByLabelText(/^(пароль|password)$/i), "Secret123!");
    await userEvent.click(canvas.getByRole("button", { name: /увійти|sign in/i }));
    await waitFor(async () => {
      await expect(canvas.getByText(/підтвердіть свою|verify your email/i)).toBeVisible();
    });
    await expect(canvas.getByRole("button", { name: /надіслати повторно|resend/i })).toBeVisible();
  },
};
