import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn } from "storybook/test";

import { AuthLayout } from "./auth-layout";
import { EmailSentPanel } from "./email-sent-panel";

const meta = {
  args: {
    cooldownSeconds: 0,
    hint: "Не отримав(ла) лист? Перевір теку „Спам“ або спробуй інший e-mail.",
    lead: "Якщо такий акаунт існує, ми надіслали лист на reader@example.com.",
    onResend: fn(),
    resendPending: false,
    title: "Перевір свою пошту",
  },
  component: EmailSentPanel,
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
  title: "Auth/EmailSentPanel",
} satisfies Meta<typeof EmailSentPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: /перевір свою пошту/i })).toBeVisible();
    await expect(canvas.getByText(/reader@example\.com/)).toBeVisible();
    await expect(canvas.getByRole("link", { name: /повернутися до входу/i })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /надіслати ще раз/i })).toBeEnabled();
  },
};

export const SeededCooldownOnMount: Story = {
  args: { cooldownSeconds: 45 },
  play: async ({ canvas }) => {
    const resend = canvas.getByRole("button", { name: /через 45 с|in 45s/i });
    await expect(resend).toHaveAttribute("aria-disabled", "true");
    await expect(resend).toBeEnabled();
  },
};

export const ResendPending: Story = {
  args: { resendPending: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /зачекайте/i })).toBeDisabled();
  },
};
