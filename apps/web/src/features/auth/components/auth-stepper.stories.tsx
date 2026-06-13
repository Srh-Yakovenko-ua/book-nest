import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { AuthStepper } from "./auth-stepper";

const STEPS = [
  { id: "request", label: "Запит" },
  { id: "email", label: "Пошта" },
] as const;

const meta = {
  args: {
    ariaLabel: "Кроки відновлення паролю",
    current: 0,
    steps: STEPS,
  },
  component: AuthStepper,
  decorators: [
    (Story) => (
      <div className="w-full max-w-[432px] p-8">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "Auth/AuthStepper",
} satisfies Meta<typeof AuthStepper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RequestActive: Story = {
  play: async ({ canvas }) => {
    const first = canvas.getByRole("button", { name: /запит/i });
    await expect(first).toHaveAttribute("aria-current", "step");
    await expect(canvas.getByRole("button", { name: /пошта/i })).not.toHaveAttribute(
      "aria-current",
    );
  },
};

export const EmailActive: Story = {
  args: { current: 1 },
  play: async ({ canvas }) => {
    const second = canvas.getByRole("button", { name: /пошта/i });
    await expect(second).toHaveAttribute("aria-current", "step");
  },
};
