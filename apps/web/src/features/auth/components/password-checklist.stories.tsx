import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { PasswordChecklist } from "./password-checklist";

const meta = {
  args: {
    password: "",
  },
  component: PasswordChecklist,
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "Auth/PasswordChecklist",
} satisfies Meta<typeof PasswordChecklist>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Partial: Story = {
  args: { password: "abcdefgh" },
};

export const AllMet: Story = {
  args: { password: "Abcdefg1!" },
  play: async ({ canvasElement }) => {
    const items = canvasElement.querySelectorAll("[data-slot='password-checklist'] li");
    await expect(items.length).toBe(4);
  },
};
