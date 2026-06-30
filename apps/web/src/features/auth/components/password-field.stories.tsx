import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent } from "storybook/test";

import { PasswordField } from "./password-field";

const meta = {
  args: {
    defaultValue: "Secret123!",
    placeholder: "Enter your password",
  },
  component: PasswordField,
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "Auth/PasswordField",
} satisfies Meta<typeof PasswordField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TogglesVisibility: Story = {
  play: async ({ canvas, canvasElement }) => {
    const input = canvasElement.querySelector("input");
    await expect(input?.getAttribute("type")).toBe("password");

    const toggle = canvas.getByRole("button", { name: /показати пароль|show password/i });
    await userEvent.click(toggle);
    await expect(input?.getAttribute("type")).toBe("text");

    const hide = canvas.getByRole("button", { name: /сховати пароль|hide password/i });
    await userEvent.click(hide);
    await expect(input?.getAttribute("type")).toBe("password");
  },
};
