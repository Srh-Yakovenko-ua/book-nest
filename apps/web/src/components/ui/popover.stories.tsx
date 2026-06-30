import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./popover";

const meta = {
  component: Popover,
  tags: ["ai-generated"],
  title: "UI/Popover",
} satisfies Meta<typeof Popover>;

export default meta;

type Story = StoryObj<typeof meta>;

function RenameListPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Перейменувати</Button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Назва списку</PopoverTitle>
          <PopoverDescription>Видима лише тобі.</PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="popover-name">Назва</Label>
          <Input defaultValue="Літо 2026" id="popover-name" />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const Default: Story = {
  render: () => <RenameListPopover />,
};

export const OpensOnClick: Story = {
  render: () => <RenameListPopover />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Перейменувати" });
    await userEvent.click(trigger);

    const surface = within(document.body);
    const dialog = await surface.findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(surface.getByText("Назва списку")).toBeVisible();
  },
};

export const EscapeClosesAndReturnsFocus: Story = {
  render: () => <RenameListPopover />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Перейменувати" });
    await userEvent.click(trigger);

    const surface = within(document.body);
    await surface.findByRole("dialog");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(surface.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
