import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor } from "storybook/test";

import { AuthLayout } from "./auth-layout";
import { RegisterForm } from "./register-form";

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
  component: RegisterForm,
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
  title: "Auth/RegisterForm",
} satisfies Meta<typeof RegisterForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText(/^імʼя|^name/i)).toBeVisible();
    await expect(canvas.getByRole("button", { name: /зареєструватися|sign up/i })).toBeVisible();
  },
};

export const PasswordChecklistUpdates: Story = {
  play: async ({ canvas }) => {
    const password = canvas.getByLabelText(/^пароль|^password/i);
    await userEvent.type(password, "Secret123!");
    await waitFor(async () => {
      await expect(canvas.getByText(/надійний|середній|strong|medium/i)).toBeVisible();
    });
  },
};

export const TermsRequiredOnSubmit: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: /зареєструватися|sign up/i }));
    await waitFor(async () => {
      const alerts = await canvas.findAllByRole("alert");
      await expect(alerts.length).toBeGreaterThan(0);
    });
  },
};

export const VerificationSent: Story = {
  beforeEach: () => {
    mockFetch((path) => {
      if (path.includes("/api/auth/registration")) {
        return jsonResponse(201, { email: "reader@example.com", status: "verification_sent" });
      }
      return jsonResponse(200, { available: true });
    });
  },
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText(/^імʼя|^name/i), "Ada Lovelace");
    await userEvent.type(canvas.getByLabelText(/електронна пошта|^email/i), "reader@example.com");
    await userEvent.type(canvas.getByLabelText(/^пароль|^password/i), "Secret123!");
    await userEvent.type(canvas.getByLabelText(/підтвердження|confirm/i), "Secret123!");
    await userEvent.click(canvas.getByRole("checkbox"));
    await userEvent.click(canvas.getByRole("button", { name: /зареєструватися|sign up/i }));
    await waitFor(async () => {
      await expect(canvas.getByText(/перевірте пошту|check your inbox/i)).toBeVisible();
    });
  },
};
