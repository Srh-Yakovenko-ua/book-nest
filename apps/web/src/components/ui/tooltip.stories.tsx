import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const meta = {
  component: Tooltip,
  tags: ["ai-generated"],
  title: "UI/Tooltip",
} satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

function AddToShelfTooltip() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Додати на полицю</Button>
      </TooltipTrigger>
      <TooltipContent>Зберегти книгу до бібліотеки</TooltipContent>
    </Tooltip>
  );
}

export const Default: Story = {
  render: () => <AddToShelfTooltip />,
};

export const AppearsOnFocus: Story = {
  render: () => <AddToShelfTooltip />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Додати на полицю" });
    trigger.focus();
    await expect(trigger).toHaveFocus();

    const surface = within(document.body);
    await waitFor(async () => {
      const tip = await surface.findByRole("tooltip");
      await expect(tip).toBeVisible();
    });
  },
};

export const AppearsOnHover: Story = {
  render: () => <AddToShelfTooltip />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Додати на полицю" });
    await userEvent.hover(trigger);

    const surface = within(document.body);
    await waitFor(async () => {
      const tip = await surface.findByRole("tooltip");
      await expect(tip).toBeVisible();
    });
  },
};
