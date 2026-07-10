import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { DeliverySubnav } from "./delivery-subnav";

const meta = {
  component: DeliverySubnav,
  parameters: { layout: "padded" },
  tags: ["ai-generated"],
  title: "Delivery/DeliverySubnav",
} satisfies Meta<typeof DeliverySubnav>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByRole("link", { name: "Історія" })).toBeVisible());
    await expect(canvas.getByRole("link", { name: "В дорозі" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Статистика" })).toBeVisible();
  },
};
