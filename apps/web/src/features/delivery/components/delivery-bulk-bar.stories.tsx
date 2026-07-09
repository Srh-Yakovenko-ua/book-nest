import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, userEvent, waitFor } from "storybook/test";

import { DeliveryBulkBar } from "./delivery-bulk-bar";

const meta = {
  args: { count: 3, onClear: fn(), onReceive: fn() },
  component: DeliveryBulkBar,
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Delivery/DeliveryBulkBar",
} satisfies Meta<typeof DeliveryBulkBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas }) => {
    await waitFor(() => expect(canvas.getByText("Вибрано 3 книги")).toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "Позначити як отримані" }));
    await expect(args.onReceive).toHaveBeenCalledOnce();
  },
};
