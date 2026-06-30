import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta = {
  component: DropdownMenu,
  tags: ["ai-generated"],
  title: "UI/DropdownMenu",
} satisfies Meta<typeof DropdownMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

function BookActionsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Дії з книгою</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Дії</DropdownMenuLabel>
        <DropdownMenuItem>Позначити прочитаною</DropdownMenuItem>
        <DropdownMenuItem>Додати до списку</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Видалити</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const Default: Story = {
  render: () => <BookActionsMenu />,
};

export const OpensWithItems: Story = {
  render: () => <BookActionsMenu />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Дії з книгою" });
    await userEvent.click(trigger);

    const surface = within(document.body);
    const menu = await surface.findByRole("menu");
    await waitFor(() => expect(menu).toBeVisible());
    await expect(
      surface.getByRole("menuitem", { name: "Позначити прочитаною" }),
    ).toBeInTheDocument();
    await expect(surface.getByRole("menuitem", { name: "Видалити" })).toBeInTheDocument();
  },
};

export const SelectingItemClosesAndReturnsFocus: Story = {
  render: () => <BookActionsMenu />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Дії з книгою" });
    await userEvent.click(trigger);

    const surface = within(document.body);
    await surface.findByRole("menu");

    const item = surface.getByRole("menuitem", { name: "Додати до списку" });
    await userEvent.click(item);

    await waitFor(() => expect(surface.queryByRole("menu")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
