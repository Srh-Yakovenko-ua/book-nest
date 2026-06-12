import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./context-menu";

const meta = {
  component: ContextMenu,
  tags: ["ai-generated"],
  title: "UI/ContextMenu",
} satisfies Meta<typeof ContextMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

function BookCoverContextMenu() {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="grid h-40 w-32 place-items-center rounded-xl border border-dashed border-border bg-card text-sm text-muted-foreground">
        Клік правою
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>Книга</ContextMenuLabel>
        <ContextMenuItem>Відкрити</ContextMenuItem>
        <ContextMenuItem>Додати до списку</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">Видалити</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const Default: Story = {
  render: () => <BookCoverContextMenu />,
};

export const OpensWithItems: Story = {
  render: () => <BookCoverContextMenu />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByText("Клік правою");
    fireEvent.contextMenu(trigger);

    const surface = within(document.body);
    const menu = await surface.findByRole("menu");
    await expect(menu).toBeVisible();
    await expect(surface.getByRole("menuitem", { name: "Відкрити" })).toBeVisible();
    await expect(surface.getByRole("menuitem", { name: "Видалити" })).toBeVisible();
  },
};

export const EscapeCloses: Story = {
  render: () => <BookCoverContextMenu />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByText("Клік правою");
    fireEvent.contextMenu(trigger);

    const surface = within(document.body);
    await surface.findByRole("menu");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(surface.queryByRole("menu")).not.toBeInTheDocument());
  },
};
