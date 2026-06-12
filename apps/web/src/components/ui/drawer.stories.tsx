import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer";

const meta = {
  component: Drawer,
  tags: ["ai-generated"],
  title: "UI/Drawer",
} satisfies Meta<typeof Drawer>;

export default meta;

type Story = StoryObj<typeof meta>;

function QuickActionsDrawer() {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Швидкі дії</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Швидкі дії</DrawerTitle>
          <DrawerDescription>Обери дію для цієї книги.</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-2 px-5 py-2 text-sm text-muted-foreground">
          Познач прочитаною, додай до списку або поділись.
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="ghost">Скасувати</Button>
          </DrawerClose>
          <DrawerClose asChild>
            <Button>Зберегти</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export const Default: Story = {
  render: () => <QuickActionsDrawer />,
};

export const OpensAndTrapsFocus: Story = {
  render: () => <QuickActionsDrawer />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Швидкі дії" });
    await userEvent.click(trigger);

    const surface = within(document.body);
    const dialog = await surface.findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());

    await userEvent.tab();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true), {
      timeout: 3000,
    });
  },
};

export const CloseReturnsFocus: Story = {
  render: () => <QuickActionsDrawer />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Швидкі дії" });
    await userEvent.click(trigger);

    const surface = within(document.body);
    await surface.findByRole("dialog");

    const cancel = surface.getByRole("button", { name: "Скасувати" });
    await userEvent.click(cancel);

    await waitFor(() => expect(surface.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
