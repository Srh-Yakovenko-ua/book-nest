import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { FormBanner } from "./form-banner";

const meta = {
  args: {
    children: "Invalid email or password",
    variant: "error",
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["error", "success"],
    },
  },
  component: FormBanner,
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "Auth/FormBanner",
} satisfies Meta<typeof FormBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Error: Story = {
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent("Invalid email or password");
  },
};

export const Success: Story = {
  args: {
    children: "Your account has been created",
    variant: "success",
  },
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent("Your account has been created");
  },
};
