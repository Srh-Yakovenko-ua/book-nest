import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, userEvent, waitFor } from "storybook/test";

import { DeliveryBulkBar } from "./delivery-bulk-bar";

const meta = {
  args: { bookCount: 12, onClear: fn(), onReceive: fn(), shipmentCount: 3 },
  component: DeliveryBulkBar,
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Delivery/DeliveryBulkBar",
} satisfies Meta<typeof DeliveryBulkBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas }) => {
    await waitFor(() => expect(canvas.getByText("Вибрано 3 посилки")).toBeVisible());
    await expect(canvas.getByText("12 книг")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Позначити отриманими" }));
    await expect(args.onReceive).toHaveBeenCalledOnce();
  },
};
