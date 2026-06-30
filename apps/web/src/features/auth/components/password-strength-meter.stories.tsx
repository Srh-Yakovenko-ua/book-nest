import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { PasswordStrengthMeter } from "./password-strength-meter";

const meta = {
  args: {
    password: "",
  },
  component: PasswordStrengthMeter,
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "Auth/PasswordStrengthMeter",
} satisfies Meta<typeof PasswordStrengthMeter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const segments = canvasElement.querySelectorAll("[data-slot='password-strength'] span");
    await expect(segments.length).toBe(4);
  },
};

export const Weak: Story = {
  args: { password: "abcdefgh" },
};

export const Medium: Story = {
  args: { password: "Abcdefg1" },
};

export const Strong: Story = {
  args: { password: "Abcdefg1!" },
};
